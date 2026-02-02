import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const META_API_VERSION = 'v21.0';

const metaToken = process.env.META_TOKEN;
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';
const metaAccounts = metaAccountsEnv.split(',').map((s) => s.trim()).filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function sumPurchaseValue(
  arr: { action_type?: string; value?: string | number }[] | undefined
): number {
  if (!arr || !Array.isArray(arr)) return 0;
  return arr.reduce((sum, item) => {
    const type = String(item.action_type || '');
    if (!type.toLowerCase().includes('purchase')) return sum;
    const val = Number(item.value ?? 0);
    return sum + (Number.isFinite(val) ? val : 0);
  }, 0);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!metaToken || metaAccounts.length === 0) {
    return res.status(200).json({
      success: true,
      message: 'No token/accounts configured',
      synced: 0,
    });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase not configured' });
  }

  const body = typeof req.body === 'object' ? req.body : {};
  const datePreset = (body.datePreset as string) || 'last_7d';
  const maxAccountsPerRun = Math.min(Math.max(Number(body.maxAccountsPerRun) || 1, 1), 5);
  const maxAdsPerAccount = Math.min(Math.max(Number(body.maxAdsPerAccount) || 15, 1), 30);

  const accountsToProcess = metaAccounts.slice(0, maxAccountsPerRun);
  const errors: { account?: string; ad_id?: string; error: string }[] = [];
  let synced = 0;
  let adsListed = 0;

  for (const actId of accountsToProcess) {
    try {
      const listUrl = new URL(`https://graph.facebook.com/${META_API_VERSION}/${actId}/ads`);
      listUrl.searchParams.set('fields', 'id,name,account_id');
      listUrl.searchParams.set('limit', String(maxAdsPerAccount));
      listUrl.searchParams.set('access_token', metaToken);

      const listResp = await fetch(listUrl.toString());
      if (!listResp.ok) {
        const txt = await listResp.text();
        errors.push({ account: actId, error: `list failed ${listResp.status}: ${txt.slice(0, 300)}` });
        continue;
      }

      const listJson = (await listResp.json()) as {
        data?: { id: string; name?: string; account_id?: string }[];
        error?: { message?: string; code?: number };
      };
      if (listJson.error) {
        errors.push({
          account: actId,
          error: `Meta API: ${listJson.error.message || JSON.stringify(listJson.error)}`,
        });
        continue;
      }
      const ads = listJson.data || [];
      adsListed += ads.length;

      for (const ad of ads) {
        try {
          const insightsUrl = new URL(
            `https://graph.facebook.com/${META_API_VERSION}/${ad.id}/insights`
          );
          insightsUrl.searchParams.set(
            'fields',
            'spend,impressions,clicks,cpm,cpc,ctr,actions,action_values'
          );
          insightsUrl.searchParams.set('date_preset', datePreset);
          insightsUrl.searchParams.set('access_token', metaToken);

          const iResp = await fetch(insightsUrl.toString());
          if (!iResp.ok) {
            const txt = await iResp.text();
            errors.push({
              account: actId,
              ad_id: ad.id,
              error: `insights failed ${iResp.status}: ${txt.slice(0, 200)}`,
            });
            continue;
          }

          const iJson = (await iResp.json()) as {
            data?: Array<{
              spend?: string;
              impressions?: string;
              clicks?: string;
              cpm?: string;
              cpc?: string;
              ctr?: string;
              actions?: { action_type?: string; value?: string | number }[];
              action_values?: { action_type?: string; value?: string | number }[];
            }>;
          };
          const first = iJson?.data?.[0];
          if (!first) {
            errors.push({ account: actId, ad_id: ad.id, error: 'no insights data' });
            continue;
          }

          const spend = Math.max(0, Number(first.spend ?? 0));
          const actions = first.actions ?? [];
          const actionValues = first.action_values ?? [];
          const purchases = sumPurchaseValue(actions);
          const purchaseValue = sumPurchaseValue(actionValues);
          const roas =
            spend > 0 && Number.isFinite(purchaseValue)
              ? purchaseValue / spend
              : null;

          const row = {
            ad_id: ad.id,
            account_id: ad.account_id ?? actId,
            name: ad.name ?? null,
            spend,
            impressions: Math.max(0, Number(first.impressions ?? 0)),
            clicks: Math.max(0, Number(first.clicks ?? 0)),
            cpm: Math.max(0, Number(first.cpm ?? 0)),
            cpc: Math.max(0, Number(first.cpc ?? 0)),
            ctr: Math.max(0, Number(first.ctr ?? 0)),
            purchases,
            purchase_value: purchaseValue,
            roas,
            currency: null,
            date_preset: datePreset,
            fetched_at: new Date().toISOString(),
          };

          const { error: upsertError } = await supabase
            .from('performance_insights')
            .upsert(row, { onConflict: 'ad_id' });

          if (upsertError) {
            errors.push({
              account: actId,
              ad_id: ad.id,
              error: `upsert failed: ${upsertError.message}`,
            });
          } else {
            synced += 1;
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          errors.push({ account: actId, ad_id: ad.id, error: msg });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push({ account: actId, error: msg });
    }
  }

  let message: string | undefined;
  if (synced > 0) {
    message = `Synced ${synced} ad(s).`;
  } else if (errors.length > 0) {
    message = errors[0].error;
  } else if (adsListed === 0) {
    message =
      'Meta API returned 0 ads. Check META_AD_ACCOUNTS (e.g. act_123) and token permissions (ads_read).';
  }

  return res.status(200).json({
    success: true,
    synced,
    datePreset,
    ...(message && { message }),
    ...(errors.length > 0 && { errors }),
  });
}

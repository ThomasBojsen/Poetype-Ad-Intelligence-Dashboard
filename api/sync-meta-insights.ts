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

/**
 * Meta returns the same conversion under multiple action types (purchase, omni_purchase,
 * offsite_conversion.fb_pixel_purchase). Summing all causes 2-3x overcounting.
 * Use only ONE canonical type, in priority order.
 */
const PURCHASE_ACTION_PRIORITY = [
  'omni_purchase',
  'offsite_conversion.fb_pixel_purchase',
  'purchase',
];

function getSinglePurchaseMetric(
  arr: { action_type?: string; value?: string | number }[] | undefined
): number {
  if (!arr || !Array.isArray(arr)) return 0;
  for (const canonicalType of PURCHASE_ACTION_PRIORITY) {
    const item = arr.find((a) => String(a.action_type || '').toLowerCase() === canonicalType);
    if (item) {
      const val = Number(item.value ?? 0);
      return Number.isFinite(val) ? val : 0;
    }
  }
  return 0;
}

/** Extract outbound/link clicks from various Meta API response formats. Prefer outbound, fall back to link clicks. */
function getClickCount(
  row: {
    outbound_clicks?: string | number | { value?: string | number }[];
    inline_link_clicks?: string | number;
    actions?: { action_type?: string; value?: string | number }[];
  }
): number {
  const ob = row.outbound_clicks;
  if (ob != null) {
    if (typeof ob === 'number' && Number.isFinite(ob)) return ob;
    if (typeof ob === 'string') {
      const n = Number(ob);
      if (Number.isFinite(n)) return n;
    }
    if (Array.isArray(ob) && ob.length > 0) {
      const v = ob[0]?.value ?? ob[0];
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  const item = row.actions?.find((a) =>
    ['outbound_click', 'link_click', 'inline_link_click'].includes(String(a.action_type || '').toLowerCase())
  );
  if (item) {
    const n = Number(item.value ?? 0);
    if (Number.isFinite(n)) return n;
  }
  const inline = row.inline_link_clicks;
  if (inline != null) {
    const n = typeof inline === 'number' ? inline : Number(inline);
    if (Number.isFinite(n)) return n;
  }
  const clicks = row.clicks;
  if (clicks != null) {
    const n = typeof clicks === 'number' ? clicks : Number(clicks);
    if (Number.isFinite(n)) return n;
  }
  return 0;
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
  const since = typeof body.since === 'string' ? body.since.trim() : '';
  const until = typeof body.until === 'string' ? body.until.trim() : '';
  const useTimeRange = since && until && /^\d{4}-\d{2}-\d{2}$/.test(since) && /^\d{4}-\d{2}-\d{2}$/.test(until);
  const datePreset = useTimeRange ? `${since} - ${until}` : ((body.datePreset as string) || 'last_30d');
  const accountOffset = Math.max(0, Number(body.accountOffset) || 0);
  const accountsPerBatch = Math.min(
    Math.max(Number(body.accountsPerBatch) || 1, 1),
    10
  );
  const maxAdsPerAccount = Math.min(Math.max(Number(body.maxAdsPerAccount) || 100, 1), 500);

  const accountsToProcess = metaAccounts.slice(accountOffset, accountOffset + accountsPerBatch);
  const errors: { account?: string; ad_id?: string; error: string }[] = [];
  let synced = 0;
  let adsListed = 0;

  type AdItem = { id: string; name?: string; account_id?: string };
  async function fetchAllAdsForAccount(actId: string): Promise<AdItem[]> {
    const all: AdItem[] = [];
    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${actId}/ads?fields=id,name,account_id&limit=100&access_token=${metaToken}`;
    while (url && all.length < maxAdsPerAccount) {
      const resp = await fetch(url);
      if (!resp.ok) return all;
      const json = (await resp.json()) as {
        data?: AdItem[];
        error?: { message?: string };
        paging?: { next?: string };
      };
      if (json.error) return all;
      const page = json.data || [];
      all.push(...page);
      url = (json.paging?.next && page.length === 100) ? json.paging.next : null;
    }
    return all.slice(0, maxAdsPerAccount);
  }

  for (const actId of accountsToProcess) {
    try {
      const ads = await fetchAllAdsForAccount(actId);
      adsListed += ads.length;

      for (const ad of ads) {
        try {
          const insightsUrl = new URL(
            `https://graph.facebook.com/${META_API_VERSION}/${ad.id}/insights`
          );
          insightsUrl.searchParams.set(
            'fields',
            'spend,impressions,outbound_clicks,inline_link_clicks,clicks,actions,action_values'
          );
          if (useTimeRange) {
            insightsUrl.searchParams.set('time_range[since]', since);
            insightsUrl.searchParams.set('time_range[until]', until);
          } else {
            insightsUrl.searchParams.set('date_preset', datePreset);
          }
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
              outbound_clicks?: string | number | { value?: string | number }[];
              inline_link_clicks?: string | number;
              clicks?: string | number;
              actions?: { action_type?: string; value?: string | number }[];
              action_values?: { action_type?: string; value?: string | number }[];
            }>;
          };
          const dataRows = iJson?.data || [];
          if (dataRows.length === 0) {
            errors.push({ account: actId, ad_id: ad.id, error: 'no insights data' });
            continue;
          }

          let spend = 0;
          let impressions = 0;
          let outboundClicks = 0;
          let purchases = 0;
          let purchaseValue = 0;
          for (const row of dataRows) {
            spend += Math.max(0, Number(row.spend ?? 0));
            impressions += Math.max(0, Number(row.impressions ?? 0));
            outboundClicks += getClickCount(row);
            purchases += getSinglePurchaseMetric(row.actions);
            purchaseValue += getSinglePurchaseMetric(row.action_values);
          }

          const roas =
            spend > 0 && Number.isFinite(purchaseValue)
              ? purchaseValue / spend
              : null;

          const ctr = impressions > 0 ? (outboundClicks / impressions) * 100 : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpc = outboundClicks > 0 ? spend / outboundClicks : 0;

          const row = {
            ad_id: ad.id,
            account_id: ad.account_id ?? actId,
            name: ad.name ?? null,
            spend,
            impressions,
            clicks: outboundClicks,
            cpm,
            cpc,
            ctr,
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

  const nextOffset = accountOffset + accountsToProcess.length;
  const hasMore = nextOffset < metaAccounts.length;

  return res.status(200).json({
    success: true,
    synced,
    datePreset,
    totalAccounts: metaAccounts.length,
    processedAccounts: accountsToProcess.length,
    accountOffset: nextOffset,
    hasMore,
    ...(message && { message }),
    ...(errors.length > 0 && { errors }),
  });
}

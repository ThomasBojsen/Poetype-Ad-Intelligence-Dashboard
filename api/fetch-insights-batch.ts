import type { VercelRequest, VercelResponse } from '@vercel/node';

const metaToken = process.env.META_TOKEN;

/** Meta returns the same conversion under multiple action types. Use only one to avoid 2-3x overcounting. */
const PURCHASE_ACTION_PRIORITY = ['omni_purchase', 'offsite_conversion.fb_pixel_purchase', 'purchase'];

function getSinglePurchaseMetric(arr: { action_type?: string; value?: string | number }[] | undefined): number {
  if (!arr || !Array.isArray(arr)) return 0;
  for (const t of PURCHASE_ACTION_PRIORITY) {
    const item = arr.find((a) => String(a.action_type || '').toLowerCase() === t);
    if (item) {
      const val = Number(item.value ?? 0);
      return Number.isFinite(val) ? val : 0;
    }
  }
  return 0;
}

function getClickCount(row: any): number {
  const ob = row?.outbound_clicks;
  if (ob != null) {
    if (typeof ob === 'number' && Number.isFinite(ob)) return ob;
    if (typeof ob === 'string') {
      const n = Number(ob);
      if (Number.isFinite(n)) return n;
    }
    if (Array.isArray(ob) && ob.length > 0) {
      const outboundItems = ob.filter((a: any) =>
        String(a?.action_type || '').toLowerCase().includes('outbound')
      );
      const toSum = outboundItems.length > 0 ? outboundItems : ob;
      const sum = toSum.reduce((acc: number, a: any) => {
        const v = a?.value ?? a;
        const n = typeof v === 'number' ? v : Number(v);
        return acc + (Number.isFinite(n) ? n : 0);
      }, 0);
      if (sum > 0) return sum;
      const v = ob[0]?.value ?? ob[0];
      const n = Number(v);
      if (Number.isFinite(n)) return n;
    }
  }
  const item = (row?.actions || []).find((a: any) =>
    ['outbound_click', 'link_click', 'inline_link_click'].includes(String(a?.action_type || '').toLowerCase())
  );
  if (item) {
    const n = Number(item.value ?? 0);
    if (Number.isFinite(n)) return n;
  }
  const inline = row?.inline_link_clicks;
  if (inline != null) {
    const n = typeof inline === 'number' ? inline : Number(inline);
    if (Number.isFinite(n)) return n;
  }
  const clicks = row?.clicks;
  if (clicks != null) {
    const n = typeof clicks === 'number' ? clicks : Number(clicks);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';
const metaAccounts = metaAccountsEnv.split(',').map(s => s.trim()).filter(Boolean);

// Supabase (use only to store cached insights)
import { createClient } from '@supabase/supabase-js';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!metaToken || metaAccounts.length === 0) return res.status(200).json({ success: true, message: 'No token/accounts' });
  if (!supabase) return res.status(500).json({ error: 'Supabase not configured' });

  const datePreset = (req.body?.datePreset as string) || 'last_7d';
  const adLimit = Number(req.body?.adLimit || 30);

  const results: any[] = [];

  for (const act of metaAccounts) {
    try {
      // List ads for this account (limited)
      const listUrl = new URL(`https://graph.facebook.com/v19.0/${act}/ads`);
      listUrl.searchParams.set('fields', 'id,name,account_id');
      listUrl.searchParams.set('limit', String(adLimit));
      listUrl.searchParams.set('access_token', metaToken);
      const listResp = await fetch(listUrl.toString());
      if (!listResp.ok) {
        const txt = await listResp.text();
        results.push({ account: act, error: `list failed ${listResp.status}`, detail: txt });
        continue;
      }
      const listJson = await listResp.json();
      const ads = listJson.data || [];

      for (const ad of ads) {
        const insightsUrl = new URL(`https://graph.facebook.com/v19.0/${ad.id}/insights`);
        insightsUrl.searchParams.set('fields', 'spend,impressions,outbound_clicks,inline_link_clicks,clicks,actions,action_values,purchase_roas,currency');
        insightsUrl.searchParams.set('date_preset', datePreset);
        insightsUrl.searchParams.set('action_attribution_windows', '["28d_click"]');
        insightsUrl.searchParams.set('access_token', metaToken);
        const iResp = await fetch(insightsUrl.toString());
        if (!iResp.ok) {
          const txt = await iResp.text();
          results.push({ account: act, ad_id: ad.id, error: `insights failed ${iResp.status}`, detail: txt });
          continue;
        }
        const iJson = await iResp.json();
        const first = iJson?.data?.[0];
        if (!first) {
          results.push({ account: act, ad_id: ad.id, info: 'no data' });
          continue;
        }
        const actions = first.actions || [];
        const actionValues = first.action_values || [];
        const purchaseRoas = first.purchase_roas && first.purchase_roas.length > 0 ? Number(first.purchase_roas[0].value || 0) : 0;
        const purchases = getSinglePurchaseMetric(actions);
        const purchaseValue = getSinglePurchaseMetric(actionValues);
        const spend = Number(first.spend || 0);
        const impressions = Number(first.impressions || 0);
        const outboundClicks = getClickCount(first);
        const ctr = impressions > 0 ? (outboundClicks / impressions) * 100 : 0;
        const cpc = outboundClicks > 0 ? spend / outboundClicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

        const row = {
          ad_id: ad.id,
          account_id: ad.account_id,
          name: ad.name,
          spend,
          impressions,
          clicks: outboundClicks,
          cpm,
          cpc,
          ctr,
          purchases,
          purchase_value: purchaseValue,
          roas: purchaseRoas,
          currency: first.currency,
          date_preset: datePreset,
          fetched_at: new Date().toISOString(),
        };

        const { error: upsertError } = await supabase
          .from('performance_insights')
          .upsert(row, { onConflict: 'ad_id' });
        if (upsertError) {
          results.push({ account: act, ad_id: ad.id, error: 'upsert failed', detail: upsertError.message });
        } else {
          results.push({ account: act, ad_id: ad.id, ok: true });
        }
      }
    } catch (err:any) {
      results.push({ account: act, error: err.message });
    }
  }

  return res.status(200).json({ success: true, results });
}

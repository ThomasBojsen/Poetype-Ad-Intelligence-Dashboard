import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const metaToken = process.env.META_TOKEN;
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const metaAccounts = metaAccountsEnv
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

async function fetchInsightsForAds(adIds: string[], datePreset: string): Promise<Record<string, any>> {
  if (!metaToken || metaAccounts.length === 0) {
    console.warn('META_TOKEN or META_AD_ACCOUNTS missing; skipping insights');
    return {};
  }

  const uniqueIds = Array.from(new Set(adIds)).filter(Boolean);
  const insightsMap: Record<string, any> = {};

  for (const adId of uniqueIds) {
    try {
      const url = new URL(`https://graph.facebook.com/v19.0/${adId}/insights`);
      url.searchParams.set('fields', 'spend,impressions,outbound_clicks,inline_link_clicks,clicks,actions,action_values,purchase_roas,currency');
      url.searchParams.set('date_preset', datePreset);
      url.searchParams.set('access_token', metaToken);

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const text = await resp.text();
        console.warn(`Insights fetch failed for ad ${adId}: ${resp.status} ${text}`);
        continue;
      }
      const data = await resp.json();
      const first = data?.data?.[0];
      if (!first) continue;

      const actions = first.actions as any[] | undefined;
      const actionValues = first.action_values as any[] | undefined;
      const roasArr = first.roas as any[] | undefined;

      const purchases = getSinglePurchaseMetric(actions);
      const purchaseValue = getSinglePurchaseMetric(actionValues);
      const roas = roasArr && roasArr.length > 0 ? Number(roasArr[0].value || 0) : 0;
      const spend = Number(first.spend || 0);
      const impressions = Number(first.impressions || 0);
      const outboundClicks = getClickCount(first);
      const ctr = impressions > 0 ? (outboundClicks / impressions) * 100 : 0;
      const cpc = outboundClicks > 0 ? spend / outboundClicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;

      insightsMap[adId] = {
        spend,
        impressions,
        clicks: outboundClicks,
        cpm,
        cpc,
        ctr,
        roas,
        purchases,
        purchase_value: purchaseValue,
        currency: first.currency,
        date_preset: datePreset,
      };
    } catch (err) {
      console.warn(`Error fetching insights for ad ${adId}:`, err);
    }
  }

  return insightsMap;
}

async function persistInsights(
  adIdToSupabaseId: Record<string, string>,
  insightsMap: Record<string, any>
) {
  const updates = Object.entries(insightsMap).map(([adId, insight]) => {
    const supaId = adIdToSupabaseId[adId];
    if (!supaId) return null;
    return {
      id: supaId,
      spend: insight.spend,
      impressions: insight.impressions,
      clicks: insight.clicks,
      cpm: insight.cpm,
      cpc: insight.cpc,
      ctr: insight.ctr,
      roas: insight.roas,
      purchases: insight.purchases,
      purchase_value: insight.purchase_value,
      insights_currency: insight.currency,
      insights_date_preset: insight.date_preset,
      last_insights_at: new Date().toISOString(),
    };
  }).filter(Boolean) as any[];

  if (updates.length === 0) return;

  const { error } = await supabase
    .from('ads')
    .upsert(updates, { onConflict: 'id' });

  if (error) {
    console.warn('Failed to persist insights to Supabase (refresh):', error.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const datePreset = (req.body?.datePreset as string) || 'last_7d';
  const batchLimit = 50;

  try {
    const { data, error } = await supabase
      .from('ads')
      .select('id, ad_id')
      .not('ad_id', 'is', null)
      .limit(5000);

    if (error) {
      console.error('Failed to fetch ads for insights refresh:', error);
      return res.status(500).json({ error: 'Failed to fetch ads' });
    }

    const adIdToSupabaseId: Record<string, string> = {};
    const adIds: string[] = [];
    (data || []).slice(0, batchLimit).forEach((row) => {
      if (row.ad_id) {
        adIdToSupabaseId[row.ad_id] = row.id;
        adIds.push(row.ad_id);
      }
    });

    if (adIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No ads with ad_id to refresh.' });
    }

    const insightsMap = await fetchInsightsForAds(adIds, datePreset);
    await persistInsights(adIdToSupabaseId, insightsMap);

    return res.status(200).json({ success: true, refreshed: Object.keys(insightsMap).length, datePreset });
  } catch (err: any) {
    console.error('Unexpected error in refresh-insights:', err);
    return res.status(500).json({ error: 'Internal server error', details: err.message });
  }
}

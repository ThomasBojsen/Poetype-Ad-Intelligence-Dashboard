import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { META_API_VERSION, computeMetrics, type InsightsRow } from './_lib/meta-helpers.js';

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

async function fetchInsightsForAds(adIds: string[], datePreset: string): Promise<Record<string, ReturnType<typeof computeMetrics> & { currency?: string; date_preset: string }>> {
  if (!metaToken || metaAccounts.length === 0) {
    console.warn('META_TOKEN or META_AD_ACCOUNTS missing; skipping insights');
    return {};
  }

  const uniqueIds = Array.from(new Set(adIds)).filter(Boolean);
  const insightsMap: Record<string, ReturnType<typeof computeMetrics> & { currency?: string; date_preset: string }> = {};

  for (const adId of uniqueIds) {
    try {
      const url = new URL(`https://graph.facebook.com/${META_API_VERSION}/${adId}/insights`);
      url.searchParams.set('fields', 'spend,impressions,outbound_clicks,inline_link_clicks,clicks,actions,action_values,currency');
      url.searchParams.set('date_preset', datePreset);
      url.searchParams.set('action_attribution_windows', '["28d_click"]');
      url.searchParams.set('access_token', metaToken);

      const resp = await fetch(url.toString());
      if (!resp.ok) {
        const text = await resp.text();
        console.warn(`Insights fetch failed for ad ${adId}: ${resp.status} ${text}`);
        continue;
      }
      const data = await resp.json();
      const first = data?.data?.[0] as (InsightsRow & { currency?: string }) | undefined;
      if (!first) continue;

      const m = computeMetrics(first);
      insightsMap[adId] = {
        ...m,
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
  insightsMap: Record<string, ReturnType<typeof computeMetrics> & { currency?: string; date_preset: string }>
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
  }).filter(Boolean) as Array<Record<string, unknown>>;

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

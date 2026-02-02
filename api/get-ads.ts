import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

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

function parseAdIdFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

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

function getOutboundClicks(first: any, actions: any[] | undefined): number {
  const direct = Number(first?.outbound_clicks ?? 0);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const item = (actions || []).find((a) => String(a?.action_type || '').toLowerCase() === 'outbound_click');
  const val = item ? Number(item.value ?? 0) : 0;
  return Number.isFinite(val) ? val : 0;
}

async function fetchInsightsForAds(
  adIds: string[],
  datePreset: string = 'last_30d'
): Promise<Record<string, any>> {
  if (!metaToken || metaAccounts.length === 0) {
    console.warn('META_TOKEN or META_AD_ACCOUNTS missing; skipping insights');
    return {};
  }

  const uniqueIds = Array.from(new Set(adIds)).filter(Boolean);
  const insightsMap: Record<string, any> = {};

  for (const adId of uniqueIds) {
    try {
      const url = new URL(`https://graph.facebook.com/v19.0/${adId}/insights`);
      url.searchParams.set('fields', 'spend,impressions,outbound_clicks,actions,action_values,purchase_roas,currency');
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
      const outboundClicks = getOutboundClicks(first, actions);
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
    console.warn('Failed to persist insights to Supabase:', error.message);
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.method === 'GET' 
      ? (req.query.sessionId as string)
      : req.body?.sessionId;

    const datePreset = (req.method === 'GET' 
      ? (req.query.datePreset as string)
      : req.body?.datePreset) || 'last_30d';

    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('ad_library_url')
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return res.status(500).json({ error: 'Failed to fetch brands', details: brandsError.message });
    }

    if (!brands || brands.length === 0) {
      return res.status(200).json({ success: true, ads: [], count: 0 });
    }

    const brandUrls = brands.map(b => b.ad_library_url);

    const { data: ads, error: adsError } = await supabase
      .from('ads')
      .select('*')
      .in('brand_ad_library_url', brandUrls)
      .order('reach', { ascending: false });

    if (adsError) {
      console.error('Error fetching ads:', adsError);
      return res.status(500).json({ error: 'Failed to fetch ads', details: adsError.message });
    }

    let lastUpdated: string | null = null;
    if (ads && ads.length > 0) {
      const timestamps = ads
        .map(ad => ad.last_seen)
        .filter(ts => ts != null)
        .sort()
        .reverse();
      lastUpdated = timestamps[0] || null;
    }

    const now = new Date();
    const adIdToSupabaseId: Record<string, string> = {};
    const enhancedAds = (ads || []).map(ad => {
      let days_active = 1;
      const startDate = ad.start_date_formatted || ad.start_date || ad.started_running || ad.first_seen || ad.firstSeen;

      if (startDate) {
        try {
          let dateString = String(startDate);
          if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            dateString = dateString.replace(' ', 'T');
          }
          const firstSeenDate = new Date(dateString);
          if (!isNaN(firstSeenDate.getTime())) {
            const diffTime = now.getTime() - firstSeenDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            days_active = diffDays < 1 ? 1 : diffDays;
          }
        } catch (error) {
          console.warn(`Error parsing date for ad ${ad.id}:`, startDate, error);
        }
      }

      const viral_score = Math.round((ad.reach || 0) / days_active);
      const ad_id = parseAdIdFromUrl(ad.ad_library_url || ad.ad_snapshot_url || ad.brand_ad_library_url);
      if (ad_id) adIdToSupabaseId[ad_id] = ad.id;

      return { ...ad, days_active, viral_score, ad_id };
    });

    let insightsMap: Record<string, any> = {};
    try {
      const adIds = enhancedAds.map((a) => a.ad_id).filter(Boolean) as string[];
      if (adIds.length > 0) {
        insightsMap = await fetchInsightsForAds(adIds, datePreset);
        await persistInsights(adIdToSupabaseId, insightsMap);
      }
    } catch (err) {
      console.warn('Failed to fetch/persist insights:', err);
    }

    const mergedAds = enhancedAds.map((ad) => {
      const insight = ad.ad_id ? insightsMap[ad.ad_id] : null;
      return {
        ...ad,
        spend: insight?.spend ?? ad.spend ?? null,
        impressions: insight?.impressions ?? ad.impressions ?? null,
        clicks: insight?.clicks ?? ad.clicks ?? null,
        cpm: insight?.cpm ?? ad.cpm ?? null,
        cpc: insight?.cpc ?? ad.cpc ?? null,
        ctr: insight?.ctr ?? ad.ctr ?? null,
        roas: insight?.roas ?? ad.roas ?? null,
        purchases: insight?.purchases ?? ad.purchases ?? null,
        purchase_value: insight?.purchase_value ?? ad.purchase_value ?? null,
        insights_currency: insight?.currency ?? ad.insights_currency ?? null,
        insights_date_preset: insight?.date_preset ?? ad.insights_date_preset ?? datePreset,
      };
    });

    const sortedAds = mergedAds.sort((a, b) => (b.reach || 0) - (a.reach || 0));

    return res.status(200).json({
      success: true,
      ads: sortedAds,
      count: sortedAds.length,
      lastUpdated,
      insightsDatePreset: datePreset,
    });
  } catch (error: any) {
    console.error('Unexpected error in get-ads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

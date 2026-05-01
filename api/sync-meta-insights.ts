import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { META_API_VERSION, computeMetrics, type InsightsRow } from './_lib/meta-helpers.js';

const metaToken = process.env.META_TOKEN;
const metaAccountsEnv = process.env.META_AD_ACCOUNTS || '';
const metaAccounts = metaAccountsEnv.split(',').map((s) => s.trim()).filter(Boolean);

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const datePreset = useTimeRange ? `${since} → ${until}` : ((body.datePreset as string) || 'last_30d');
  const accountOffset = Math.max(0, Number(body.accountOffset) || 0);
  const accountsPerBatch = Math.min(
    Math.max(Number(body.accountsPerBatch) || 1, 1),
    10
  );
  const maxAdsPerAccount = Math.min(Math.max(Number(body.maxAdsPerAccount) || 100, 1), 500);

  const accountsToProcess = metaAccounts.slice(accountOffset, accountOffset + accountsPerBatch);
  const errors: { account?: string; ad_id?: string; error: string }[] = [];
  let synced = 0;
  let skipped = 0;
  let adsListed = 0;

  type AdItem = {
    id: string;
    name?: string;
    account_id?: string;
    effective_status?: string;
    creative?: {
      thumbnail_url?: string;
      image_url?: string;
      image_hash?: string;
      video_id?: string;
      effective_object_story_id?: string;
      object_story_spec?: {
        video_data?: { image_url?: string };
        link_data?: { picture?: string; image_hash?: string };
      };
    };
  };
  // Meta returns creative.thumbnail_url at small default size. Field expansion
  // with width/height requests a higher resolution version (much sharper in
  // card view at 250-300px). object_story_spec.video_data.image_url and
  // creative.image_url are fetched as higher-quality fallbacks.
  const creativeFields =
    'creative{thumbnail_url.width(600).height(600),image_url,image_hash,video_id,' +
    'effective_object_story_id,' +
    'object_story_spec{video_data{image_url},link_data{picture,image_hash}}}';
  async function fetchAllAdsForAccount(actId: string): Promise<AdItem[]> {
    const all: AdItem[] = [];
    let url: string | null = `https://graph.facebook.com/${META_API_VERSION}/${actId}/ads?fields=id,name,account_id,effective_status,${creativeFields}&limit=100&access_token=${metaToken}`;
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

  /**
   * Generic batched GET helper. Returns map of input id → parsed body.
   * Handles Meta's 50-per-batch limit transparently.
   */
  async function batchedGet<T>(
    ids: string[],
    fields: string
  ): Promise<Map<string, T>> {
    const map = new Map<string, T>();
    if (ids.length === 0 || !metaToken) return map;
    const BATCH_SIZE = 50;
    for (let i = 0; i < ids.length; i += BATCH_SIZE) {
      const chunk = ids.slice(i, i + BATCH_SIZE);
      const batch = chunk.map((id) => ({
        method: 'GET',
        relative_url: `${id}?fields=${fields}`,
      }));
      try {
        const resp = await fetch(`https://graph.facebook.com/${META_API_VERSION}/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `access_token=${encodeURIComponent(metaToken)}&batch=${encodeURIComponent(
            JSON.stringify(batch)
          )}`,
        });
        if (!resp.ok) continue;
        const results = (await resp.json()) as Array<{ code?: number; body?: string } | null>;
        for (let j = 0; j < chunk.length; j++) {
          const r = results[j];
          if (r?.code === 200 && r.body) {
            try {
              map.set(chunk[j], JSON.parse(r.body) as T);
            } catch {
              /* skip malformed */
            }
          }
        }
      } catch {
        /* fallbacks still apply */
      }
    }
    return map;
  }

  /**
   * Pick the highest-resolution video thumbnail. Meta's /video/picture returns
   * one fixed size (often low-res for UGC phone videos), but /video/thumbnails
   * and /video/custom_thumbnails can return higher-res or brand-uploaded
   * versions. Prefer custom uploads, then thumbnails marked is_preferred,
   * then largest available.
   */
  type ThumbItem = {
    uri?: string;
    url?: string;
    width?: number;
    height?: number;
    is_preferred?: boolean;
  };
  type VideoInfo = {
    picture?: string;
    thumbnails?: { data?: ThumbItem[] };
    custom_thumbnails?: ThumbItem[];
  };
  function pickBestThumb(items: ThumbItem[]): string | null {
    if (items.length === 0) return null;
    const preferred = items.find((t) => t.is_preferred && (t.uri || t.url));
    if (preferred) return preferred.uri ?? preferred.url ?? null;
    const sorted = [...items]
      .filter((t) => t.uri || t.url)
      .sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return sorted[0]?.uri ?? sorted[0]?.url ?? null;
  }
  function bestVideoThumbnail(info: VideoInfo | undefined): string | null {
    if (!info) return null;
    const custom = pickBestThumb(info.custom_thumbnails ?? []);
    if (custom) return custom;
    const fromList = pickBestThumb(info.thumbnails?.data ?? []);
    if (fromList) return fromList;
    return info.picture ?? null;
  }

  /**
   * For DPA/catalog ads (no own thumbnail), or any ad with a real post,
   * pull the highest-resolution rendered media from the post itself.
   * attachments.media.image.src is the original-size media; full_picture
   * is a fallback (Meta sometimes serves a smaller version).
   */
  type PostInfo = {
    full_picture?: string;
    picture?: string;
    attachments?: {
      data?: Array<{
        media?: { image?: { src?: string; width?: number; height?: number } };
        subattachments?: {
          data?: Array<{
            media?: { image?: { src?: string; width?: number; height?: number } };
          }>;
        };
      }>;
    };
  };
  function bestPostThumbnail(info: PostInfo | undefined): string | null {
    if (!info) return null;
    const att = info.attachments?.data ?? [];
    for (const a of att) {
      const src = a?.media?.image?.src;
      if (src) return src;
      const sub = a?.subattachments?.data ?? [];
      for (const s of sub) {
        if (s?.media?.image?.src) return s.media.image.src;
      }
    }
    return info.full_picture ?? info.picture ?? null;
  }

  /**
   * Last-resort high-quality thumbnail extraction: fetch the rendered
   * ad preview iframe and parse it for fbcdn image URLs. The iframe is
   * what Meta itself renders in feed, so it embeds full-quality assets.
   * Two fetches per ad — only call for ads where higher-priority sources
   * fail (typically video ads with no custom_thumbnails or HD adimages).
   * See docs/meta-thumbnail-research.md for the full reasoning.
   */
  async function fetchPreviewImageUrl(adId: string): Promise<string | null> {
    if (!metaToken) return null;
    try {
      const previewsUrl =
        `https://graph.facebook.com/${META_API_VERSION}/${adId}/previews` +
        `?ad_format=INSTAGRAM_STANDARD` +
        `&access_token=${encodeURIComponent(metaToken)}`;
      const resp = await fetch(previewsUrl);
      if (!resp.ok) return null;
      const json = (await resp.json()) as { data?: Array<{ body?: string }> };
      const iframeHtml = json.data?.[0]?.body;
      if (!iframeHtml) return null;
      const srcMatch = iframeHtml.match(/src="([^"]+)"/);
      if (!srcMatch) return null;
      const iframeSrc = srcMatch[1].replace(/&amp;/g, '&');
      const iframeResp = await fetch(iframeSrc, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
            'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      if (!iframeResp.ok) return null;
      const html = await iframeResp.text();
      const og = html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i);
      if (og) return og[1].replace(/&amp;/g, '&');
      const poster = html.match(/<video[^>]+poster=["']([^"']+)["']/i);
      if (poster) return poster[1].replace(/&amp;/g, '&');
      const imgRegex = /<img[^>]+src=["']([^"']+fbcdn[^"']+)["']/gi;
      for (const m of Array.from(html.matchAll(imgRegex))) {
        const u = m[1].replace(/&amp;/g, '&');
        if (/[\/_]p\d{1,2}x\d{1,2}/.test(u)) continue;
        if (u.includes('profile') || u.includes('avatar')) continue;
        return u;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Resolve creative.image_hash to the original uploaded asset URL via
   * /act_X/adimages. This is the actual file the brand uploaded — full
   * resolution, no Meta-side downscaling.
   */
  async function fetchAdImagesByHash(
    actId: string,
    hashes: string[]
  ): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    if (hashes.length === 0 || !metaToken) return map;
    const unique = Array.from(new Set(hashes));
    const url =
      `https://graph.facebook.com/${META_API_VERSION}/${actId}/adimages` +
      `?hashes=${encodeURIComponent(JSON.stringify(unique))}` +
      `&fields=hash,url,permalink_url,width,height` +
      `&access_token=${encodeURIComponent(metaToken)}`;
    try {
      const resp = await fetch(url);
      if (!resp.ok) return map;
      const json = (await resp.json()) as {
        data?: Array<{ hash?: string; url?: string; permalink_url?: string }>;
      };
      for (const img of json.data ?? []) {
        if (img.hash && (img.url || img.permalink_url)) {
          map.set(img.hash, img.url ?? img.permalink_url ?? '');
        }
      }
    } catch {
      /* fallbacks still apply */
    }
    return map;
  }

  for (const actId of accountsToProcess) {
    try {
      const ads = await fetchAllAdsForAccount(actId);
      adsListed += ads.length;

      const videoIds = Array.from(
        new Set(ads.map((a) => a.creative?.video_id).filter((v): v is string => !!v))
      );
      const storyIds = Array.from(
        new Set(
          ads
            .map((a) => a.creative?.effective_object_story_id)
            .filter((v): v is string => !!v)
        )
      );
      const imageHashes = ads
        .flatMap((a) => [
          a.creative?.image_hash,
          a.creative?.object_story_spec?.link_data?.image_hash,
        ])
        .filter((v): v is string => !!v);
      const [videoInfos, postInfos, imagesByHash] = await Promise.all([
        batchedGet<VideoInfo>(videoIds, 'picture,thumbnails,custom_thumbnails'),
        batchedGet<PostInfo>(
          storyIds,
          'full_picture,picture,attachments{media{image{src,width,height}},subattachments{media{image{src,width,height}}}}'
        ),
        fetchAdImagesByHash(actId, imageHashes),
      ]);

      // Preview-based HD extraction (concurrent per account). Run for any ad
      // whose creative-level fields don't yield an HD URL — typically video
      // ads where Meta's thumbnail_url is hard-capped at 64x64.
      const previewMap = new Map<string, string>();
      const adsForPreview = ads.filter((a) => {
        const c = a.creative;
        if (!c) return false;
        if (c.image_url) return false;
        if (c.image_hash && imagesByHash.has(c.image_hash)) return false;
        const linkHash = c.object_story_spec?.link_data?.image_hash;
        if (linkHash && imagesByHash.has(linkHash)) return false;
        if (c.video_id && videoInfos.get(c.video_id)?.custom_thumbnails?.length) return false;
        return true;
      });
      const previewResults = await Promise.all(
        adsForPreview.map(async (a) => [a.id, await fetchPreviewImageUrl(a.id)] as const)
      );
      for (const [id, url] of previewResults) {
        if (url) previewMap.set(id, url);
      }

      for (const ad of ads) {
        try {
          const insightsUrl = new URL(
            `https://graph.facebook.com/${META_API_VERSION}/${ad.id}/insights`
          );
          insightsUrl.searchParams.set(
            'fields',
            'spend,impressions,outbound_clicks,inline_link_clicks,clicks,actions,action_values,account_currency'
          );
          if (useTimeRange) {
            insightsUrl.searchParams.set('time_range[since]', since);
            insightsUrl.searchParams.set('time_range[until]', until);
          } else {
            insightsUrl.searchParams.set('date_preset', datePreset);
          }
          insightsUrl.searchParams.set('action_attribution_windows', '["28d_click"]');
          // Report conversions on the impression/click date, not the conversion date.
          // Without this, paused ads get "ghost revenue" from conversions that happen
          // after the ad was paused (within the 28d_click window).
          insightsUrl.searchParams.set('action_report_time', 'impression');
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

          const iJson = (await iResp.json()) as { data?: InsightsRow[] };
          const dataRows = iJson?.data || [];
          if (dataRows.length === 0) {
            skipped += 1;
            continue;
          }

          let spend = 0;
          let impressions = 0;
          let clicks = 0;
          let purchases = 0;
          let purchase_value = 0;
          let currency: string | null = null;
          for (const r of dataRows) {
            const m = computeMetrics(r);
            spend += m.spend;
            impressions += m.impressions;
            clicks += m.clicks;
            purchases += m.purchases;
            purchase_value += m.purchase_value;
            if (!currency && r.account_currency) currency = r.account_currency;
          }

          const roas =
            spend > 0 && Number.isFinite(purchase_value) ? purchase_value / spend : null;
          const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
          const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
          const cpc = clicks > 0 ? spend / clicks : 0;

          // Priority: original uploaded asset → rendered post media → preview iframe → fallbacks.
          const c = ad.creative;
          const hash = c?.image_hash || c?.object_story_spec?.link_data?.image_hash;
          const originalImage = hash ? imagesByHash.get(hash) ?? null : null;
          const videoThumb = c?.video_id
            ? bestVideoThumbnail(videoInfos.get(c.video_id))
            : null;
          const postPicture = c?.effective_object_story_id
            ? bestPostThumbnail(postInfos.get(c.effective_object_story_id))
            : null;
          const previewImage = previewMap.get(ad.id) ?? null;
          const thumbnailUrl =
            originalImage ||
            videoThumb ||
            postPicture ||
            c?.image_url ||
            previewImage ||
            c?.object_story_spec?.video_data?.image_url ||
            c?.object_story_spec?.link_data?.picture ||
            c?.thumbnail_url ||
            null;
          const creativeType: 'video' | 'image' | null = c?.video_id
            ? 'video'
            : thumbnailUrl
            ? 'image'
            : null;

          const row = {
            ad_id: ad.id,
            account_id: ad.account_id ?? actId,
            name: ad.name ?? null,
            spend,
            impressions,
            clicks,
            cpm,
            cpc,
            ctr,
            purchases,
            purchase_value,
            roas,
            currency,
            date_preset: datePreset,
            fetched_at: new Date().toISOString(),
            thumbnail_url: thumbnailUrl,
            creative_type: creativeType,
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
    message =
      skipped > 0
        ? `Synced ${synced} ad(s); ${skipped} had no activity in this period.`
        : `Synced ${synced} ad(s).`;
  } else if (errors.length > 0) {
    message = errors[0].error;
  } else if (skipped > 0) {
    message = `${skipped} ad(s) had no activity in this period.`;
  } else if (adsListed === 0) {
    message =
      'Meta API returned 0 ads. Check META_AD_ACCOUNTS (e.g. act_123) and token permissions (ads_read).';
  }

  const nextOffset = accountOffset + accountsToProcess.length;
  const hasMore = nextOffset < metaAccounts.length;

  return res.status(200).json({
    success: true,
    synced,
    skipped,
    datePreset,
    totalAccounts: metaAccounts.length,
    processedAccounts: accountsToProcess.length,
    accountOffset: nextOffset,
    hasMore,
    ...(message && { message }),
    ...(errors.length > 0 && { errors }),
  });
}

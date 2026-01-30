import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apifyToken = process.env.APIFY_TOKEN;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!apifyToken) {
  throw new Error('Missing APIFY_TOKEN environment variable');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const apifyClient = new ApifyClient({ token: apifyToken });

function parseAdIdFromUrl(url?: string | null): string | null {
  if (!url || typeof url !== 'string') return null;
  const match = url.match(/[?&]id=(\d+)/);
  return match ? match[1] : null;
}

/**
 * Extract video URL from Apify data structure
 * Handles fallback: cards[0].video_hd_url vs videos[0]
 */
function extractVideoUrl(item: any): string {
  // Try snapshot.cards first (primary structure based on Apify JSON)
  if (item.snapshot?.cards && Array.isArray(item.snapshot.cards)) {
    for (const card of item.snapshot.cards) {
      if (card?.video_hd_url) return card.video_hd_url;
      if (card?.video_url) return card.video_url;
      if (card?.videoUrl) return card.videoUrl;
      if (card?.video) {
        if (typeof card.video === 'string') return card.video;
        if (card.video?.url) return card.video.url;
        if (card.video?.video_hd_url) return card.video.video_hd_url;
        if (card.video?.video_url) return card.video.video_url;
      }
    }
  }
  
  // Try ad_snapshot_data.snapshot.cards (alternative structure)
  if (item.ad_snapshot_data?.snapshot?.cards && Array.isArray(item.ad_snapshot_data.snapshot.cards)) {
    for (const card of item.ad_snapshot_data.snapshot.cards) {
      if (card?.video_hd_url) return card.video_hd_url;
      if (card?.video_url) return card.video_url;
      if (card?.videoUrl) return card.videoUrl;
      if (card?.video) {
        if (typeof card.video === 'string') return card.video;
        if (card.video?.url) return card.video.url;
        if (card.video?.video_hd_url) return card.video.video_hd_url;
        if (card.video?.video_url) return card.video.video_url;
      }
    }
  }
  
  // Try cards[0].video_hd_url
  if (item.cards && Array.isArray(item.cards) && item.cards.length > 0) {
    const card = item.cards[0];
    if (card?.video_hd_url) return card.video_hd_url;
    if (card?.video_url) return card.video_url;
    if (card?.videoUrl) return card.videoUrl;
    if (card?.video) {
      if (typeof card.video === 'string') return card.video;
      if (card.video?.url) return card.video.url;
      if (card.video?.video_hd_url) return card.video.video_hd_url;
      if (card.video?.video_url) return card.video.video_url;
    }
  }
  
  // Try ad_snapshot_data.cards
  if (item.ad_snapshot_data?.cards && Array.isArray(item.ad_snapshot_data.cards) && item.ad_snapshot_data.cards.length > 0) {
    const card = item.ad_snapshot_data.cards[0];
    if (card?.video_hd_url) return card.video_hd_url;
    if (card?.video_url) return card.video_url;
    if (card?.videoUrl) return card.videoUrl;
    if (card?.video) {
      if (typeof card.video === 'string') return card.video;
      if (card.video?.url) return card.video.url;
      if (card.video?.video_hd_url) return card.video.video_hd_url;
      if (card.video?.video_url) return card.video.video_url;
    }
  }
  
  // Fallback to videos[0]
  if (item.videos && Array.isArray(item.videos) && item.videos.length > 0) {
    const video = item.videos[0];
    if (typeof video === 'string') return video;
    if (video?.url) return video.url;
    if (video?.video_hd_url) return video.video_hd_url;
    if (video?.video_url) return video.video_url;
  }
  
  // Additional fallbacks
  if (item.video_hd_url) return item.video_hd_url;
  if (item.video_url) return item.video_url;
  if (item.videoUrl) return item.videoUrl;
  if (item.video) {
    if (typeof item.video === 'string') return item.video;
    if (item.video?.url) return item.video.url;
  }
  
  return '';
}

/**
 * Map Apify dataset item to our ads table schema
 */
function mapApifyItemToAd(item: any, adLibraryUrl: string): any {
  // Log first item to debug structure (only log once)
  if (!mapApifyItemToAd._logged) {
    console.log('Sample Apify item structure:', JSON.stringify(item, null, 2));
    mapApifyItemToAd._logged = true;
  }

  // Extract heading from various possible locations
  // Priority: snapshot.cards[0].title (actual title) > snapshot.title (may be template variable)
  const heading = (item.snapshot?.cards && Array.isArray(item.snapshot.cards) && item.snapshot.cards.length > 0 && item.snapshot.cards[0]?.title)
    || (item.ad_snapshot_data?.snapshot?.cards && Array.isArray(item.ad_snapshot_data.snapshot.cards) && item.ad_snapshot_data.snapshot.cards.length > 0 && item.ad_snapshot_data.snapshot.cards[0]?.title)
    || item.heading 
    || item.title 
    || item.adTitle
    || item.adText
    || item.headline
    || item.ad_snapshot_data?.title
    || item.ad_snapshot_data?.adTitle
    || item.ad_snapshot_data?.adText
    || item.ad_snapshot_data?.snapshot?.title
    || item.ad_snapshot_data?.snapshot?.adTitle
    || item.ad_snapshot_data?.snapshot?.adText
    || item.ad_snapshot_data?.body
    || item.snapshot?.title
    || item.snapshot?.adTitle
    || item.snapshot?.adText
    || (item.snapshot?.body && typeof item.snapshot.body === 'string' ? item.snapshot.body : item.snapshot?.body?.text)
    || '';

  // Extract ad copy from various possible locations
  // Priority: snapshot.cards[0].body (actual body) > snapshot.body.text (may be template variable)
  const adCopy = (item.snapshot?.cards && Array.isArray(item.snapshot.cards) && item.snapshot.cards.length > 0 && item.snapshot.cards[0]?.body)
    || (item.ad_snapshot_data?.snapshot?.cards && Array.isArray(item.ad_snapshot_data.snapshot.cards) && item.ad_snapshot_data.snapshot.cards.length > 0 && item.ad_snapshot_data.snapshot.cards[0]?.body)
    || item.ad_copy 
    || item.body 
    || item.text 
    || item.description
    || item.adBody
    || item.adText
    || item.ad_snapshot_data?.body
    || item.ad_snapshot_data?.text
    || item.ad_snapshot_data?.adBody
    || item.ad_snapshot_data?.adText
    || item.ad_snapshot_data?.snapshot?.body
    || item.ad_snapshot_data?.snapshot?.text
    || item.ad_snapshot_data?.snapshot?.adBody
    || item.ad_snapshot_data?.snapshot?.adText
    || (item.snapshot?.body && typeof item.snapshot.body === 'string' ? item.snapshot.body : item.snapshot?.body?.text)
    || item.snapshot?.text
    || item.snapshot?.adBody
    || item.snapshot?.adText
    || '';

  // Extract thumbnail from various possible locations
  let thumbnail = item.thumbnail_url 
    || item.thumbnailUrl 
    || item.image_url
    || item.imageUrl
    || item.thumbnail
    || item.image
    || '';

  if (!thumbnail) {
    const cardsArrays = [
      item.snapshot?.cards,
      item.ad_snapshot_data?.snapshot?.cards,
      item.cards,
      item.ad_snapshot_data?.cards,
    ].filter(Boolean);

    for (const cards of cardsArrays) {
      if (Array.isArray(cards)) {
        for (const card of cards) {
          if (card?.resized_image_url) { thumbnail = card.resized_image_url; break; }
          if (card?.original_image_url) { thumbnail = card.original_image_url; break; }
          if (card?.image_url) { thumbnail = card.image_url; break; }
          if (card?.imageUrl) { thumbnail = card.imageUrl; break; }
          if (card?.thumbnail_url) { thumbnail = card.thumbnail_url; break; }
          if (card?.thumbnailUrl) { thumbnail = card.thumbnailUrl; break; }
          if (card?.thumbnail) { thumbnail = card.thumbnail; break; }
          if (card?.image) {
            thumbnail = typeof card.image === 'string' ? card.image : card.image?.url || '';
            if (thumbnail) break;
          }
        }
        if (thumbnail) break;
      }
    }
  }

  if (!thumbnail) {
    thumbnail = 'https://poetype.dk/wp-content/uploads/2023/04/POETYPE-LOGO.svg';
  }

  const reach = item.aaa_info?.eu_total_reach
    || item.transparency_by_location?.eu_transparency?.eu_total_reach
    || item.reach_estimate
    || item.reach
    || item.reachLower
    || item.reachUpper
    || item.impressions
    || 0;

  const rawFirstSeen = item.first_seen || item.firstSeen || item.started_running || item.start_date_formatted || item.start_date || null;
  let first_seen = null;
  if (rawFirstSeen) {
    try {
      let dateString = String(rawFirstSeen);
      if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
        dateString = dateString.replace(' ', 'T');
      }
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        first_seen = date.toISOString();
      }
    } catch (error) {
      console.warn(`Error parsing first_seen date:`, rawFirstSeen, error);
    }
  }

  const start_date_formatted = item.start_date_formatted || item.start_date || null;

  const ad_library_url = item.ad_library_url || item.adSnapshotUrl || '';
  const brand_ad_library_url = (item.url && typeof item.url === 'string' && item.url.trim() !== '')
    ? item.url
    : adLibraryUrl;

  if (!mapApifyItemToAd._urlLogged) {
    console.log('ad_library_url source:', {
      item_ad_library_url: item.ad_library_url,
      item_ad_library_url_type: typeof item.ad_library_url,
      item_ad_library_url_length: item.ad_library_url?.length,
      item_ad_library_url_trimmed: item.ad_library_url?.trim(),
      item_url: item.url,
      item_adSnapshotUrl: item.adSnapshotUrl,
      adLibraryUrl_argument: adLibraryUrl,
      finalValue: ad_library_url,
      brandUrl: brand_ad_library_url,
      source: (item.ad_library_url && typeof item.ad_library_url === 'string' && item.ad_library_url.trim() !== '') 
        ? 'item.ad_library_url' 
        : (item.adSnapshotUrl && typeof item.adSnapshotUrl === 'string' && item.adSnapshotUrl.trim() !== '')
        ? 'item.adSnapshotUrl'
        : 'adLibraryUrl (fallback)',
    });
    mapApifyItemToAd._urlLogged = true;
  }

  const ad_id = parseAdIdFromUrl(ad_library_url || brand_ad_library_url || item.ad_snapshot_url || item.adSnapshotUrl);

  return {
    id: item.ad_archive_id || item.id || item.adId || String(item.ad_snapshot_url || Math.random()),
    page_name: item.page_name || item.pageName || item.page_name || 'Unknown',
    reach: parseInt(String(reach || '0'), 10) || 0,
    video_url: extractVideoUrl(item),
    thumbnail_url: thumbnail,
    heading: heading,
    ad_copy: adCopy,
    ad_library_url: ad_library_url,
    brand_ad_library_url: brand_ad_library_url,
    first_seen: first_seen,
    start_date_formatted: start_date_formatted,
    last_seen: new Date().toISOString(),
    ad_id,
  };
}

mapApifyItemToAd._logged = false;
mapApifyItemToAd._urlLogged = false;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const resource = req.body.resource || req.body.data?.resource;
    const runId = resource?.id;
    const datasetId = resource?.defaultDatasetId;
    const sessionId = req.query.sessionId as string | undefined;

    console.log('Webhook payload:', JSON.stringify(req.body, null, 2));
    console.log('Resource object:', JSON.stringify(resource, null, 2));
    console.log('Extracted runId:', runId);
    console.log('Extracted datasetId:', datasetId);
    console.log('Extracted sessionId from query:', sessionId);

    if (!runId) {
      return res.status(400).json({ 
        error: 'Missing runId in webhook payload',
        body: req.body 
      });
    }

    if (datasetId) {
      return await processDataset(datasetId, sessionId, res);
    }

    return await fetchAndProcessRun(runId, sessionId, res);
  } catch (error: any) {
    console.error('Unexpected error in save-ads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

async function fetchAndProcessRun(runId: string, sessionId: string | undefined, res: VercelResponse) {
  let run;
  try {
    run = await apifyClient.run(runId).get();
  } catch (error: any) {
    console.error('Error fetching run from Apify:', error);
    return res.status(400).json({ 
      error: 'Failed to fetch run from Apify',
      details: error.message,
      runId 
    });
  }

  if (!run) {
    return res.status(400).json({ error: 'Run not found', runId });
  }

  const finalDatasetId = run.defaultDatasetId;

  if (!finalDatasetId) {
    console.error('Run object:', JSON.stringify(run, null, 2));
    return res.status(400).json({ error: 'Could not determine datasetId from run', runId });
  }

  return await processDataset(finalDatasetId, sessionId, res);
}

async function processDataset(finalDatasetId: string, sessionId: string | undefined, res: VercelResponse) {
  try {
    const dataset = await apifyClient.dataset(finalDatasetId);
    const { items } = await dataset.listItems();

    if (!items || items.length === 0) {
      console.warn('No items found in Apify dataset');
      return res.status(200).json({ 
        success: true, 
        message: 'No ads to save',
        count: 0 
      });
    }

    const { data: brands } = await supabase
      .from('brands')
      .select('ad_library_url')
      .eq('session_id', sessionId || '')
      .eq('is_active', true);

    const brandUrls = brands?.map(b => b.ad_library_url) || [];

    const adsToUpsert = [];
    const now = new Date().toISOString();

    if (items.length > 0) {
      console.log('First Apify item sample:', JSON.stringify(items[0], null, 2));
    }

    for (const item of items) {
      const itemUrl = String(item.ad_snapshot_url || item.url || item.ad_library_url || '');
      const matchedBrandUrl = brandUrls.find(url => 
        itemUrl.includes(url) || url.includes(itemUrl)
      ) || itemUrl || brandUrls[0];

      const adData = mapApifyItemToAd(item, matchedBrandUrl);
      adsToUpsert.push(adData);
    }

    const upsertPromises = adsToUpsert.map(async (ad) => {
      const { data: existingAd } = await supabase
        .from('ads')
        .select('id, first_seen')
        .eq('id', ad.id)
        .single();

      const upsertData = {
        ...ad,
        first_seen: existingAd?.first_seen || ad.first_seen || now,
        last_seen: now,
      };

      const { error } = await supabase
        .from('ads')
        .upsert(upsertData, {
          onConflict: 'id',
        });

      if (error) {
        console.error(`Error upserting ad ${ad.id}:`, error);
        return { success: false, id: ad.id, error: error.message };
      }

      return { success: true, id: ad.id };
    });

    const results = await Promise.allSettled(upsertPromises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    return res.status(200).json({
      success: true,
      message: `Processed ${adsToUpsert.length} ads`,
      saved: successful,
      failed: failed,
    });
  } catch (error: any) {
    console.error('Unexpected error in processDataset:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}

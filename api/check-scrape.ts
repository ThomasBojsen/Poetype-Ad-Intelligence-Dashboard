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
  // Extract heading from various possible locations
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

  // Try cards arrays (check all cards, not just first)
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

  // Use Poetype logo as fallback placeholder if no thumbnail found
  if (!thumbnail) {
    thumbnail = 'https://poetype.dk/wp-content/uploads/2023/04/POETYPE-LOGO.svg';
  }

  // Extract reach from various possible locations
  const reach = item.aaa_info?.eu_total_reach
    || item.transparency_by_location?.eu_transparency?.eu_total_reach
    || item.reach_estimate
    || item.reach
    || item.reachLower
    || item.reachUpper
    || item.impressions
    || 0;

  // Normalize date format
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

  // Use ad_library_url directly from Apify object - no fallback, no matching
  const ad_library_url = item.ad_library_url || item.adSnapshotUrl || '';

  // Get brand's generic URL from Apify object (item.url)
  const brand_ad_library_url = (item.url && typeof item.url === 'string' && item.url.trim() !== '')
    ? item.url
    : adLibraryUrl; // Fallback to the passed argument if item.url is not available

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
  };
}

/**
 * Process dataset items and save to Supabase
 */
async function processDatasetItems(datasetId: string, sessionId: string | undefined): Promise<any[]> {
  // Fetch dataset items from Apify
  const dataset = await apifyClient.dataset(datasetId);
  const { items } = await dataset.listItems();

  if (!items || items.length === 0) {
    console.warn('No items found in Apify dataset');
    return [];
  }

  // Get ad_library_urls for this session to match ads
  const { data: brands } = await supabase
    .from('brands')
    .select('ad_library_url')
    .eq('session_id', sessionId || '')
    .eq('is_active', true);

  const brandUrls = brands?.map(b => b.ad_library_url) || [];

  // Process and upsert ads
  const adsToUpsert = [];
  const now = new Date().toISOString();

  for (const item of items) {
    // Try to match item to a brand URL
    const itemUrl = String(item.ad_snapshot_url || item.url || item.ad_library_url || '');
    const matchedBrandUrl = brandUrls.find(url => 
      itemUrl.includes(url) || url.includes(itemUrl)
    ) || itemUrl || brandUrls[0]; // Fallback to first brand or item URL

    const adData = mapApifyItemToAd(item, matchedBrandUrl);
    adsToUpsert.push(adData);
  }

  // Perform UPSERT operations
  const upsertPromises = adsToUpsert.map(async (ad) => {
    // First, check if ad exists
    const { data: existingAd } = await supabase
      .from('ads')
      .select('id, first_seen')
      .eq('id', ad.id)
      .single();

    // Extract brand_ad_library_url before upsert (not in database schema)
    const { brand_ad_library_url, ...adForDatabase } = ad;

    const upsertData = {
      ...adForDatabase,
      // Preserve first_seen if ad already exists
      first_seen: existingAd?.first_seen || ad.first_seen || now,
      last_seen: now, // Always update last_seen
    };

    const { error } = await supabase
      .from('ads')
      .upsert(upsertData, {
        onConflict: 'id',
      });

    if (error) {
      console.error(`Error upserting ad ${ad.id}:`, error);
      return null;
    }

    // Return ad with brand_ad_library_url included for response
    return ad;
  });

  const results = await Promise.allSettled(upsertPromises);
  const successfulAds = results
    .filter(r => r.status === 'fulfilled' && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value);

  return successfulAds;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Allow both GET and POST
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get runId and sessionId from query params or body
    const runId = (req.query.runId || req.body?.runId) as string | undefined;
    const sessionId = (req.query.sessionId || req.body?.sessionId) as string | undefined;

    if (!runId) {
      return res.status(400).json({ error: 'runId is required' });
    }

    // Check Apify run status
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
      return res.status(404).json({ error: 'Run not found', runId });
    }

    const status = run.status;

    // If still running, return RUNNING status
    if (status === 'RUNNING' || status === 'READY') {
      return res.status(200).json({
        status: 'RUNNING',
        runId: run.id,
      });
    }

    // If failed, return FAILED status
    if (status === 'FAILED' || status === 'ABORTED') {
      return res.status(200).json({
        status: 'FAILED',
        runId: run.id,
        message: run.statusMessage || 'Run failed',
      });
    }

    // If succeeded, fetch items and save to DB
    if (status === 'SUCCEEDED') {
      const datasetId = run.defaultDatasetId;

      if (!datasetId) {
        console.error('Run object:', JSON.stringify(run, null, 2));
        return res.status(400).json({ 
          error: 'Could not determine datasetId from run', 
          runId 
        });
      }

      // Process and save items
      const ads = await processDatasetItems(datasetId, sessionId);

      return res.status(200).json({
        status: 'COMPLETED',
        runId: run.id,
        ads: ads,
        count: ads.length,
      });
    }

    // Unknown status
    return res.status(200).json({
      status: 'UNKNOWN',
      runId: run.id,
      apifyStatus: status,
    });

  } catch (error: any) {
    console.error('Unexpected error in check-scrape:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


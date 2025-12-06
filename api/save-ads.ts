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
  // Try cards[0].video_hd_url first
  if (item.cards && Array.isArray(item.cards) && item.cards.length > 0) {
    const videoHdUrl = item.cards[0]?.video_hd_url;
    if (videoHdUrl) return videoHdUrl;
    
    const videoUrl = item.cards[0]?.video_url;
    if (videoUrl) return videoUrl;
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
  
  return '';
}

/**
 * Map Apify dataset item to our ads table schema
 */
function mapApifyItemToAd(item: any, adLibraryUrl: string): any {
  return {
    id: item.ad_archive_id || item.id || String(item.ad_snapshot_url || Math.random()),
    page_name: item.page_name || item.pageName || 'Unknown',
    reach: parseInt(item.reach || item.reachLower || item.reachUpper || '0', 10) || 0,
    video_url: extractVideoUrl(item),
    thumbnail_url: item.thumbnail_url || item.thumbnailUrl || item.image_url || '',
    heading: item.heading || item.title || '',
    ad_copy: item.ad_copy || item.body || item.text || '',
    ad_library_url: adLibraryUrl,
    first_seen: item.first_seen || item.firstSeen || null,
    last_seen: new Date().toISOString(),
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests (webhook from Apify)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract webhook payload
    // Apify webhook payload structure may vary, handle both formats
    const runId = req.body.runId || req.body.data?.runId;
    const datasetId = req.body.datasetId || req.body.data?.defaultDatasetId || req.body.defaultDatasetId;
    const sessionId = req.body.sessionId || req.body.data?.sessionId;

    if (!runId) {
      return res.status(400).json({ error: 'Missing runId in webhook payload' });
    }

    // If datasetId not provided, fetch it from the run
    let finalDatasetId = datasetId;
    if (!finalDatasetId) {
      const run = await apifyClient.run(runId).get();
      finalDatasetId = run.defaultDatasetId;
    }

    if (!finalDatasetId) {
      return res.status(400).json({ error: 'Could not determine datasetId' });
    }

    // Fetch dataset items from Apify
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
    // Match on id, update last_seen and reach, keep first_seen unchanged
    const upsertPromises = adsToUpsert.map(async (ad) => {
      // First, check if ad exists
      const { data: existingAd } = await supabase
        .from('ads')
        .select('id, first_seen')
        .eq('id', ad.id)
        .single();

      const upsertData = {
        ...ad,
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
      runId,
    });
  } catch (error: any) {
    console.error('Unexpected error in save-ads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


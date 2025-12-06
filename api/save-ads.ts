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
  // Try ad_snapshot_data.snapshot.cards first (most common structure)
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
  
  // Try snapshot.cards
  if (item.snapshot?.cards && Array.isArray(item.snapshot.cards)) {
    for (const card of item.snapshot.cards) {
      if (card?.video_hd_url) return card.video_hd_url;
      if (card?.video_url) return card.video_url;
      if (card?.videoUrl) return card.videoUrl;
      if (card?.video) {
        if (typeof card.video === 'string') return card.video;
        if (card.video?.url) return card.video.url;
      }
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
  // Common patterns: cards[].image, cards[].imageUrl, cards[].thumbnail
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
      item.ad_snapshot_data?.snapshot?.cards,
      item.cards,
      item.ad_snapshot_data?.cards,
      item.snapshot?.cards,
    ].filter(Boolean);

    for (const cards of cardsArrays) {
      if (Array.isArray(cards)) {
        for (const card of cards) {
          // Check resized_image_url first (better quality), then original_image_url
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
  // Priority: aaa_info.eu_total_reach > transparency_by_location.eu_transparency.eu_total_reach > reach_estimate
  const reach = item.aaa_info?.eu_total_reach
    || item.transparency_by_location?.eu_transparency?.eu_total_reach
    || item.reach_estimate
    || item.reach
    || item.reachLower
    || item.reachUpper
    || item.impressions
    || 0;

  return {
    id: item.ad_archive_id || item.id || item.adId || String(item.ad_snapshot_url || Math.random()),
    page_name: item.page_name || item.pageName || item.page_name || 'Unknown',
    reach: parseInt(String(reach || '0'), 10) || 0,
    video_url: extractVideoUrl(item),
    thumbnail_url: thumbnail,
    heading: heading,
    ad_copy: adCopy,
    ad_library_url: adLibraryUrl,
    first_seen: item.first_seen || item.firstSeen || item.started_running || null,
    last_seen: new Date().toISOString(),
  };
}

// Add flag to prevent logging every item
mapApifyItemToAd._logged = false;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests (webhook from Apify)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Apify webhook sends event data in standard format
    // Structure: { resource: { id, defaultDatasetId, ... }, eventType, ... }
    const resource = req.body.resource || req.body.data?.resource;
    const runId = resource?.id;
    const datasetId = resource?.defaultDatasetId;
    
    // Get sessionId from query parameter (passed in webhook URL)
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

    // If we have datasetId directly, use it
    if (datasetId) {
      return await processDataset(datasetId, sessionId, res);
    }

    // Fallback: fetch run object to get dataset ID
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
      .select('id, ad_library_url, name')
      .eq('session_id', sessionId || '')
      .eq('is_active', true);

    const brandUrls = brands?.map(b => b.ad_library_url) || [];
    
    // Track page names we've seen for each brand URL to update brand names
    const brandPageNames: Map<string, string> = new Map();

    // Process and upsert ads
    const adsToUpsert = [];
    const now = new Date().toISOString();

    // Log first item to see structure
    if (items.length > 0) {
      console.log('First Apify item sample:', JSON.stringify(items[0], null, 2));
    }

    for (const item of items) {
      // Try to match item to a brand URL
      const itemUrl = String(item.ad_snapshot_url || item.url || item.ad_library_url || '');
      const matchedBrandUrl = brandUrls.find(url => 
        itemUrl.includes(url) || url.includes(itemUrl)
      ) || itemUrl || brandUrls[0]; // Fallback to first brand or item URL

      // Track page_name for this brand URL to update brand name later
      // Get page_name from the same place we use in mapApifyItemToAd
      const pageName = (item as any).page_name 
        || (item as any).pageName 
        || (item as any).snapshot?.page_name 
        || (item as any).ad_snapshot_data?.page_name
        || (item as any).advertiser?.page?.name
        || '';
      
      // Store the page_name for this brand URL (use the first valid one we find)
      if (pageName && 
          matchedBrandUrl && 
          pageName !== 'Unknown' && 
          !pageName.match(/^\d+$/) &&
          pageName.length > 0 &&
          !brandPageNames.has(matchedBrandUrl)) {
        // Only set if we don't already have a page_name for this brand URL
        brandPageNames.set(matchedBrandUrl, pageName);
      }

      const adData = mapApifyItemToAd(item, matchedBrandUrl);
      adsToUpsert.push(adData);
    }
    
    // Update brand names with actual page names from the Apify data we just scraped
    if (brands && brandPageNames.size > 0) {
      const updatePromises = [];
      for (const brand of brands) {
        const pageName = brandPageNames.get(brand.ad_library_url);
        // Update if we have a valid page name from Apify
        if (pageName && 
            pageName !== 'Unknown' &&
            !pageName.match(/^\d+$/) &&
            pageName.length > 0 &&
            pageName !== brand.name) {
          // Always update if we have a valid page_name from Apify (it's the source of truth)
          console.log(`Updating brand ${brand.id} name from "${brand.name}" to "${pageName}" (from Apify data)`);
          updatePromises.push(
            supabase
              .from('brands')
              .update({ name: pageName })
              .eq('id', brand.id)
          );
        }
      }
      // Wait for all updates to complete
      if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        const successCount = results.filter(r => !r.error).length;
        console.log(`Updated ${successCount} brand name(s) from Apify data`);
      }
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
    });
  } catch (error: any) {
    console.error('Unexpected error in processDataset:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


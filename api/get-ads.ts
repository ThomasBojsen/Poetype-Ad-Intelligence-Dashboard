import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Allow both GET and POST requests
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract sessionId from query params (GET) or body (POST)
    const sessionId = req.method === 'GET' 
      ? req.query.sessionId as string
      : req.body?.sessionId;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    // Step 1: Get ad_library_urls associated with this session_id
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('ad_library_url')
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return res.status(500).json({ error: 'Failed to fetch brands', details: brandsError.message });
    }

    // If no brands found, return empty array
    if (!brands || brands.length === 0) {
      return res.status(200).json({
        success: true,
        ads: [],
        count: 0,
      });
    }

    const brandUrls = brands.map(b => b.ad_library_url);

    // Step 2: Select ads where ad_library_url is in the list
    const { data: ads, error: adsError } = await supabase
      .from('ads')
      .select('*')
      .in('ad_library_url', brandUrls)
      .order('reach', { ascending: false });

    if (adsError) {
      console.error('Error fetching ads:', adsError);
      return res.status(500).json({ error: 'Failed to fetch ads', details: adsError.message });
    }

    // Calculate the most recent last_seen timestamp from all ads
    let lastUpdated: string | null = null;
    if (ads && ads.length > 0) {
      const timestamps = ads
        .map(ad => ad.last_seen)
        .filter(ts => ts != null)
        .sort()
        .reverse();
      lastUpdated = timestamps[0] || null;
    }

    // Calculate days_active and viral_score for each ad
    const now = new Date();
    const enhancedAds = (ads || []).map(ad => {
      let days_active = 1; // Default to 1 to avoid division by zero
      
      // Try multiple possible field names for the start date
      const startDate = ad.first_seen || ad.start_date_formatted || ad.start_date || ad.started_running;
      
      if (startDate) {
        try {
          const firstSeenDate = new Date(startDate);
          // Check if date is valid
          if (!isNaN(firstSeenDate.getTime())) {
            const diffTime = now.getTime() - firstSeenDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // If difference is less than 1 day, default to 1
            days_active = diffDays < 1 ? 1 : diffDays;
          }
        } catch (error) {
          console.warn(`Invalid date format for ad ${ad.id}:`, startDate);
        }
      }
      
      // Calculate viral score (reach per day)
      const viral_score = Math.round(ad.reach / days_active);
      
      return {
        ...ad,
        days_active,
        viral_score,
      };
    });

    return res.status(200).json({
      success: true,
      ads: enhancedAds,
      count: enhancedAds.length,
      lastUpdated: lastUpdated,
    });
  } catch (error: any) {
    console.error('Unexpected error in get-ads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


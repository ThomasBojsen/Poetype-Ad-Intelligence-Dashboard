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

    // Step 2: Fetch ads using database-side filtering on brand_ad_library_url
    // This is much more efficient than fetching all ads and filtering in JavaScript
    const { data: ads, error: adsError } = await supabase
      .from('ads')
      .select('*')
      .in('brand_ad_library_url', brandUrls)
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
      
      // Try multiple possible field names for the start date (prioritize start_date_formatted over first_seen)
      const startDate = ad.start_date_formatted || ad.start_date || ad.started_running || ad.first_seen || ad.firstSeen;
      
      if (startDate) {
        try {
          // Handle date format "2025-11-24 08:00:00" by replacing space with T for ISO format
          let dateString = String(startDate);
          // If it's in format "YYYY-MM-DD HH:MM:SS", convert to ISO format
          if (dateString.match(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)) {
            dateString = dateString.replace(' ', 'T');
          }
          
          const firstSeenDate = new Date(dateString);
          // Check if date is valid
          if (!isNaN(firstSeenDate.getTime())) {
            const diffTime = now.getTime() - firstSeenDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            
            // If difference is less than 1 day, default to 1
            days_active = diffDays < 1 ? 1 : diffDays;
            
            // Debug logging for first ad to help troubleshoot
            if (ads && ads.indexOf(ad) === 0) {
              console.log('Date calculation debug:', {
                ad_id: ad.id,
                startDate: startDate,
                dateString: dateString,
                firstSeenDate: firstSeenDate.toISOString(),
                now: now.toISOString(),
                diffDays: diffDays,
                days_active: days_active,
                reach: ad.reach,
                viral_score: Math.round(ad.reach / days_active)
              });
            }
          } else {
            console.warn(`Invalid date for ad ${ad.id}:`, startDate, '->', dateString);
          }
        } catch (error) {
          console.warn(`Error parsing date for ad ${ad.id}:`, startDate, error);
        }
      } else {
        // Log when no start date is found
        if (ads && ads.indexOf(ad) === 0) {
          console.warn(`No start date found for ad ${ad.id}. Available fields:`, Object.keys(ad));
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

    // Sort by reach (descending - highest first)
    const sortedAds = enhancedAds.sort((a, b) => (b.reach || 0) - (a.reach || 0));

    return res.status(200).json({
      success: true,
      ads: sortedAds,
      count: sortedAds.length,
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


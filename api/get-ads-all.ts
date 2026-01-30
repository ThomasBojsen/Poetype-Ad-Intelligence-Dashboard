import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(
  _req: VercelRequest,
  res: VercelResponse
) {
  try {
    const { data: ads, error } = await supabase
      .from('ads')
      .select('*')
      .order('reach', { ascending: false })
      .limit(500);

    if (error) {
      console.error('Error fetching ads:', error);
      return res.status(500).json({ error: 'Failed to fetch ads', details: error.message });
    }

    const now = new Date();
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
      return { ...ad, days_active, viral_score };
    });

    return res.status(200).json({ success: true, ads: enhancedAds, count: enhancedAds.length });
  } catch (error: any) {
    console.error('Unexpected error in get-ads-all:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
}

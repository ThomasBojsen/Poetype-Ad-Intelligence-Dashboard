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

    return res.status(200).json({
      success: true,
      ads: ads || [],
      count: ads?.length || 0,
    });
  } catch (error: any) {
    console.error('Unexpected error in get-ads:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


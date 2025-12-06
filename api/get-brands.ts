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

    // Fetch all brands for this session (including inactive ones)
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, name, ad_library_url, is_active')
      .eq('session_id', sessionId)
      .order('id', { ascending: false });

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return res.status(500).json({ error: 'Failed to fetch brands', details: brandsError.message });
    }

    return res.status(200).json({
      success: true,
      brands: brands || [],
      count: brands?.length || 0,
    });
  } catch (error: any) {
    console.error('Unexpected error in get-brands:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


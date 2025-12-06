import { createClient } from '@supabase/supabase-js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Extract a brand name from a Facebook Ad Library URL
 * Falls back to a placeholder if extraction fails
 */
function extractBrandNameFromUrl(url: string): string {
  try {
    // Facebook Ad Library URLs typically look like:
    // https://www.facebook.com/ads/library/?id=...
    // or contain page information
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    // Try to extract from query params
    const pageName = searchParams.get('page_name') || searchParams.get('page');
    if (pageName) {
      return decodeURIComponent(pageName);
    }
    
    // Try to extract from pathname
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length > 0) {
      return pathParts[pathParts.length - 1].replace(/-/g, ' ');
    }
    
    // Fallback: use domain or a generic name
    return urlObj.hostname.replace('www.', '').split('.')[0] || 'Unknown Brand';
  } catch (error) {
    return 'Unknown Brand';
  }
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId, url } = req.body;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required and must be a string' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Extract brand name from URL
    const brandName = extractBrandNameFromUrl(url);

    // Insert new brand into database
    const { data, error } = await supabase
      .from('brands')
      .insert({
        session_id: sessionId,
        name: brandName,
        ad_library_url: url,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error inserting brand:', error);
      return res.status(500).json({ error: 'Failed to add brand', details: error.message });
    }

    return res.status(201).json({
      success: true,
      brand: data,
    });
  } catch (error) {
    console.error('Unexpected error in add-brand:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


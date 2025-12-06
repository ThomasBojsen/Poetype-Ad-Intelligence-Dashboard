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
    const urlObj = new URL(url);
    const searchParams = urlObj.searchParams;
    
    // Facebook Ad Library URLs typically look like:
    // https://www.facebook.com/ads/library/?active_status=active&search_type=page&view_all_page_id=6490973258
    // or https://www.facebook.com/ads/library/?id=...
    
    // Try to extract from query params (page_name is rarely in URL, but check anyway)
    const pageName = searchParams.get('page_name') || searchParams.get('page');
    if (pageName) {
      return decodeURIComponent(pageName);
    }
    
    // For Facebook Ad Library URLs, we can't reliably extract the brand name from the URL
    // The page_id is there, but not the name. We'll use a generic name and update it later
    // when we scrape the actual ads (which will have page_name)
    const pageId = searchParams.get('view_all_page_id') || searchParams.get('page_id');
    if (pageId) {
      return `Brand ${pageId}`;
    }
    
    // Try to extract from pathname (but skip common paths like 'ads', 'library')
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    const validParts = pathParts.filter(p => !['ads', 'library', ''].includes(p.toLowerCase()));
    if (validParts.length > 0) {
      return validParts[validParts.length - 1].replace(/-/g, ' ').replace(/_/g, ' ');
    }
    
    // Fallback: use a generic name that will be updated when ads are scraped
    return 'Brand';
  } catch (error) {
    return 'Brand';
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


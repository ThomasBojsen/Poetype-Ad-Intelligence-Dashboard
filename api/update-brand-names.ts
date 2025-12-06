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
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { sessionId } = req.body;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    // Get all active brands for this session
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('id, ad_library_url, name')
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return res.status(500).json({ error: 'Failed to fetch brands', details: brandsError.message });
    }

    if (!brands || brands.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No brands found',
        updated: 0,
      });
    }

    const updatePromises = [];
    let updatedCount = 0;

    for (const brand of brands) {
      // Check if brand name is generic
      const isGenericName = brand.name === 'Brand' || 
                            brand.name.startsWith('Brand ') || 
                            brand.name.match(/^Brand \d+$/);
      
      if (isGenericName) {
        // Query existing ads for this brand URL to get the page_name
        const { data: existingAds, error: adsError } = await supabase
          .from('ads')
          .select('page_name')
          .eq('ad_library_url', brand.ad_library_url)
          .not('page_name', 'is', null)
          .neq('page_name', 'Unknown')
          .limit(10);
        
        if (adsError) {
          console.error(`Error fetching ads for brand ${brand.id}:`, adsError);
          continue;
        }
        
        if (existingAds && existingAds.length > 0) {
          // Get the most common page_name (or just use the first one)
          const pageName = existingAds[0].page_name;
          if (pageName && 
              pageName !== 'Unknown' &&
              !pageName.match(/^\d+$/) &&
              pageName.length > 0 &&
              pageName !== brand.name) {
            console.log(`Updating brand ${brand.id} name from "${brand.name}" to "${pageName}"`);
            updatePromises.push(
              supabase
                .from('brands')
                .update({ name: pageName })
                .eq('id', brand.id)
            );
            updatedCount++;
          }
        }
      }
    }
    
    // Wait for all updates to complete
    if (updatePromises.length > 0) {
      const results = await Promise.all(updatePromises);
      const successCount = results.filter(r => !r.error).length;
      return res.status(200).json({
        success: true,
        message: `Updated ${successCount} brand name(s) from existing ads`,
        updated: successCount,
      });
    }

    return res.status(200).json({
      success: true,
      message: 'No brand names needed updating',
      updated: 0,
    });
  } catch (error: any) {
    console.error('Unexpected error in update-brand-names:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


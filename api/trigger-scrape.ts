import { createClient } from '@supabase/supabase-js';
import { ApifyClient } from 'apify-client';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apifyToken = process.env.APIFY_TOKEN;
const vercelUrl = process.env.VERCEL_URL || process.env.NEXT_PUBLIC_VERCEL_URL;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

if (!apifyToken) {
  throw new Error('Missing APIFY_TOKEN environment variable');
}

const supabase = createClient(supabaseUrl, supabaseKey);
const apifyClient = new ApifyClient({ token: apifyToken });

/**
 * Construct the webhook URL for Apify to call on completion
 */
function getWebhookUrl(): string {
  // In production, use the actual Vercel deployment URL
  // In development, you might need to use ngrok or similar
  const baseUrl = vercelUrl 
    ? `https://${vercelUrl}` 
    : process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';
  
  return `${baseUrl}/api/save-ads`;
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
    const { sessionId } = req.body;

    // Validate input
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ error: 'sessionId is required and must be a string' });
    }

    // Step 1: Fetch active brands for this session
    const { data: brands, error: brandsError } = await supabase
      .from('brands')
      .select('ad_library_url, name')
      .eq('session_id', sessionId)
      .eq('is_active', true);

    if (brandsError) {
      console.error('Error fetching brands:', brandsError);
      return res.status(500).json({ error: 'Failed to fetch brands', details: brandsError.message });
    }

    // Step 2: Check if any brands found
    if (!brands || brands.length === 0) {
      return res.status(404).json({ 
        error: 'No active brands found for this session',
        message: 'Please add at least one brand before triggering a scrape'
      });
    }

    // Step 3: Construct Apify input
    const apifyInput = {
      count: 300,
      period: 'last30d',
      scrapeAdDetails: true,
      'scrapePageAds.activeStatus': 'all',
      'scrapePageAds.countryCode': 'ALL',
      urls: brands.map(brand => ({
        url: brand.ad_library_url,
        method: 'GET',
      })),
    };

    // Step 4: Configure webhook URL
    const webhookUrl = getWebhookUrl();
    
    // Step 5: Start Apify Actor run
    // Store sessionId in run options so we can retrieve it from the webhook
    const run = await apifyClient.actor('curious_coder/facebook-ads-library-scraper').start(apifyInput, {
      waitForFinish: 0, // Don't wait, let it run async (0 = no wait)
      webhooks: [
        {
          eventTypes: ['ACTOR.RUN.SUCCEEDED'],
          requestUrl: webhookUrl,
          // Don't use custom payload template - Apify sends resource data by default
          // We'll get sessionId from the run's options or tags
        },
      ],
      // Store sessionId in run options for later retrieval
      options: {
        tags: [`sessionId:${sessionId}`],
      },
    });

    return res.status(200).json({
      success: true,
      runId: run.id,
      message: `Scraping started for ${brands.length} brand(s)`,
      brands: brands.map(b => b.name),
    });
  } catch (error: any) {
    console.error('Unexpected error in trigger-scrape:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      details: error.message 
    });
  }
}


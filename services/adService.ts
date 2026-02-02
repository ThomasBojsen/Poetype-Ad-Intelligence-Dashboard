import { AdData, PerformanceInsight } from '../types';

// API Base URL - defaults to relative path for same domain, or set VITE_API_URL env var
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// How long to wait for Apify to finish (in seconds). Default 5 minutes.
export const SCRAPE_WAIT_TIME_SECONDS = 300;

const MOCK_DATA: AdData[] = [
  {
    id: '1',
    page_name: 'Lumina Skin',
    reach: 150000,
    ad_library_url: '#',
    video_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', 
    thumbnail: 'https://picsum.photos/600/340',
    heading: 'Get Glowing Skin in 7 Days',
    ad_copy: "Stop masking your skin problems. Solve them. Our new Vitamin C serum is clinically proven to brighten skin tone.",
    days_active: 5,
    viral_score: 30000,
  },
  {
    id: '2',
    page_name: 'TechFlow',
    reach: 250000,
    ad_library_url: '#',
    video_url: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://picsum.photos/600/340?random=2',
    heading: 'Revolutionize Your Workflow',
    ad_copy: "Experience the future of productivity with our cutting-edge software solution. Join thousands of satisfied customers.",
    days_active: 12,
    viral_score: 20833,
  },
  {
    id: '3',
    page_name: 'EcoFresh',
    reach: 85000,
    ad_library_url: '#',
    video_url: '',
    thumbnail: 'https://picsum.photos/600/340?random=3',
    heading: 'Sustainable Living Starts Here',
    ad_copy: "Make a difference with our eco-friendly products. Better for you, better for the planet.",
    days_active: 3,
    viral_score: 28333,
  },
];

// Check if we're in development mode
const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const fetchAdData = async (useRealUrl: boolean = true, sessionId?: string): Promise<{ ads: AdData[], lastUpdated: string | null, insightsDatePreset?: string } | AdData[]> => {
  // In development mode, always use mock data
  if (isDevelopment) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      ads: MOCK_DATA,
      lastUpdated: new Date().toISOString(),
      insightsDatePreset: 'mock',
    };
  }

  if (!useRealUrl) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      ads: MOCK_DATA,
      lastUpdated: new Date().toISOString(),
      insightsDatePreset: 'mock',
    };
  }

  if (!sessionId) {
    console.warn("No sessionId provided, returning empty array");
    return { ads: [], lastUpdated: null };
  }

  try {
    const response = await fetch(`${API_BASE_URL}/get-ads?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch ads: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch ads');
    }

    // Map backend format (thumbnail_url) to frontend format (thumbnail)
    const mappedAds = (result.ads || []).map((ad: any) => ({
      id: ad.id,
      page_name: ad.page_name,
      reach: ad.reach,
      ad_library_url: ad.ad_library_url,
      video_url: ad.video_url || '',
      thumbnail: ad.thumbnail_url || ad.thumbnail || '',
      heading: ad.heading || '',
      ad_copy: ad.ad_copy || '',
      days_active: ad.days_active,
      viral_score: ad.viral_score,
      brand_ad_library_url: ad.brand_ad_library_url,
      ad_id: ad.ad_id,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      cpm: ad.cpm,
      cpc: ad.cpc,
      ctr: ad.ctr,
      roas: ad.roas,
      purchases: ad.purchases,
      purchase_value: ad.purchase_value,
      insights_currency: ad.insights_currency,
      insights_date_preset: ad.insights_date_preset,
    }));

    // Return ads with lastUpdated timestamp
    return {
      ads: mappedAds,
      lastUpdated: result.lastUpdated || null,
      insightsDatePreset: result.insightsDatePreset,
    };
  } catch (error) {
    console.error("Error fetching data from API", error);
    return { ads: [], lastUpdated: null }; 
  }
};

export const fetchPerformanceInsights = async (): Promise<{ ads: AdData[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-performance-insights`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Failed to fetch performance insights: ${response.statusText}`);
    const json = await response.json();
    const mapped = (json.ads || []).map((ad: any) => ({
      id: ad.ad_id || ad.id,
      page_name: ad.name || ad.ad_id,
      reach: ad.reach || 0,
      ad_library_url: '',
      video_url: '',
      thumbnail: '',
      heading: '',
      ad_copy: '',
      days_active: 0,
      viral_score: 0,
      brand_ad_library_url: '',
      ad_id: ad.ad_id || ad.id,
      spend: ad.spend,
      impressions: ad.impressions,
      clicks: ad.clicks,
      cpm: ad.cpm,
      cpc: ad.cpc,
      ctr: ad.ctr,
      roas: ad.roas,
      purchases: ad.purchases,
      purchase_value: ad.purchase_value,
      insights_currency: ad.currency,
      insights_date_preset: ad.date_preset,
      account_id: ad.account_id ?? null,
    }));
    return { ads: mapped };
  } catch (err) {
    console.error('Error fetching performance insights', err);
    return { ads: [] };
  }
};

/** Fetch performance insights as PerformanceInsight[] for Ad Index dashboard. */
export const fetchPerformanceInsightsList = async (): Promise<PerformanceInsight[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-performance-insights`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`Failed to fetch performance insights: ${response.statusText}`);
    const json = await response.json();
    const rows = json.ads || [];
    return rows.map((row: any) => ({
      ad_id: row.ad_id || row.id,
      account_id: row.account_id ?? null,
      name: row.name ?? null,
      spend: Number(row.spend ?? 0),
      impressions: Number(row.impressions ?? 0),
      clicks: Number(row.clicks ?? 0),
      cpm: Number(row.cpm ?? 0),
      cpc: Number(row.cpc ?? 0),
      ctr: Number(row.ctr ?? 0),
      purchases: Number(row.purchases ?? 0),
      purchase_value: Number(row.purchase_value ?? 0),
      roas: row.roas != null ? Number(row.roas) : null,
      currency: row.currency ?? null,
      date_preset: row.date_preset ?? null,
      fetched_at: row.fetched_at ?? null,
    }));
  } catch (err) {
    console.error('Error fetching performance insights list', err);
    return [];
  }
};

/**
 * Add a brand to the session
 */
export const addBrand = async (sessionId: string, url: string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/add-brand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, url }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to add brand:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error adding brand:", error);
    return false;
  }
};

/**
 * Trigger scraping workflow for the session
 * First adds all URLs as brands, then triggers the scrape
 */
export const triggerScrapeWorkflow = async (urls: string[], sessionId: string): Promise<{ success: boolean; runId?: string }> => {
  try {
    // Step 1: Add all URLs as brands
    const addBrandPromises = urls.map(url => addBrand(sessionId, url));
    const addResults = await Promise.allSettled(addBrandPromises);
    
    const failedAdds = addResults.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value));
    if (failedAdds.length > 0) {
      console.warn(`Failed to add ${failedAdds.length} brand(s)`);
      // Continue anyway - some brands might have been added
    }

    // Step 2: Trigger the scrape
    const response = await fetch(`${API_BASE_URL}/trigger-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to trigger scrape:", error);
      return { success: false };
    }

    const result = await response.json();
    console.log("Scrape triggered successfully:", result);
    return { 
      success: true, 
      runId: result.runId 
    };
  } catch (error) {
    console.error("Failed to trigger scrape workflow", error);
    return { success: false };
  }
};

/**
 * Trigger a refresh scrape for existing brands in the session
 * Does NOT add new brands, just triggers scrape for existing ones
 */
export const refreshSessionScrape = async (sessionId: string): Promise<{ success: boolean; runId?: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/trigger-scrape`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to refresh scrape:", error);
      return { success: false };
    }

    const result = await response.json();
    return { success: true, runId: result.runId };
  } catch (error) {
    console.error("Failed to refresh scrape", error);
    return { success: false };
  }
};

export const fetchBrands = async (sessionId: string): Promise<{ brands: any[] }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-brands?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Failed to fetch brands: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error('Error fetching brands', err);
    return { brands: [] };
  }
};

export const deleteBrand = async (sessionId: string, brandId: string | number): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-brand`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, brandId }),
    });
    if (!response.ok) {
      const error = await response.json();
      console.error('Failed to delete brand:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Error deleting brand', err);
    return false;
  }
};

export const checkScrapeStatus = async (runId: string): Promise<{ status: string }> => {
  try {
    const response = await fetch(`${API_BASE_URL}/check-scrape?runId=${encodeURIComponent(runId)}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) throw new Error(`Failed to check scrape status: ${response.statusText}`);
    return await response.json();
  } catch (err) {
    console.error('Error checking scrape status', err);
    return { status: 'unknown' };
  }
};

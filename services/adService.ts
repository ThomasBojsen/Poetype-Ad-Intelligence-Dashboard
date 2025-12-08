import { AdData } from '../types';

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

export const fetchAdData = async (useRealUrl: boolean = true, sessionId?: string): Promise<{ ads: AdData[], lastUpdated: string | null } | AdData[]> => {
  // In development mode, always use mock data
  if (isDevelopment) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      ads: MOCK_DATA,
      lastUpdated: new Date().toISOString(),
    };
  }

  if (!useRealUrl) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      ads: MOCK_DATA,
      lastUpdated: new Date().toISOString(),
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
      thumbnail: ad.thumbnail_url || '',
      heading: ad.heading || '',
      ad_copy: ad.ad_copy || '',
      days_active: ad.days_active,
      viral_score: ad.viral_score,
    }));

    // Return ads with lastUpdated timestamp
    return {
      ads: mappedAds,
      lastUpdated: result.lastUpdated || null,
    };
  } catch (error) {
    console.error("Error fetching data from API", error);
    return { ads: [], lastUpdated: null }; 
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
export const triggerScrapeWorkflow = async (urls: string[], sessionId: string): Promise<boolean> => {
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
      return false;
    }

    const result = await response.json();
    console.log("Scrape triggered successfully:", result);
    return true;
  } catch (error) {
    console.error("Failed to trigger scrape workflow", error);
    return false;
  }
};

/**
 * Trigger a refresh scrape for existing brands in the session
 * Does NOT add new brands, just triggers scrape for existing ones
 */
export const refreshSessionScrape = async (sessionId: string): Promise<boolean> => {
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
      console.error("Failed to trigger refresh scrape:", error);
      return false;
    }

    const result = await response.json();
    console.log("Refresh scrape triggered successfully:", result);
    return true;
  } catch (error) {
    console.error("Failed to trigger refresh scrape", error);
    return false;
  }
};

/**
 * Fetch brands for a session
 */
export const fetchBrands = async (sessionId: string): Promise<{ id: number | string; name: string; ad_library_url: string; is_active: boolean }[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/get-brands?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch brands: ${response.statusText}`);
    }
    
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.error || 'Failed to fetch brands');
    }

    return result.brands || [];
  } catch (error) {
    console.error("Error fetching brands:", error);
    return []; 
  }
};

/**
 * Delete a brand (soft delete: sets is_active to false)
 */
export const deleteBrand = async (sessionId: string, brandId: number | string): Promise<boolean> => {
  try {
    const response = await fetch(`${API_BASE_URL}/delete-brand`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sessionId, brandId }),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to delete brand:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error deleting brand:", error);
    return false;
  }
};

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
  },
];

export const fetchAdData = async (useRealUrl: boolean = true, sessionId?: string): Promise<{ ads: AdData[], lastUpdated: string | null } | AdData[]> => {
  if (!useRealUrl) {
    await new Promise(resolve => setTimeout(resolve, 800));
    return MOCK_DATA;
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

// CSV parsing and video URL cleaning functions removed - no longer needed
// Data now comes directly from the API
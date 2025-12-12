export interface AdData {
  id: string;
  page_name: string;
  reach: number;
  ad_library_url: string;
  video_url: string;
  thumbnail: string;
  heading: string;
  ad_copy: string;
  days_active?: number;
  viral_score?: number; // Reach per day
  brand_ad_library_url?: string; // Brand's generic ad library URL for fallback
}

export interface FilterState {
  selectedBrands: string[];
  minReach: number;
  maxReach: number;
  mediaType: 'all' | 'video' | 'image';
}
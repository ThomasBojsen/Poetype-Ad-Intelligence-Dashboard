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
  ad_id?: string | null;
  spend?: number | null;
  impressions?: number | null;
  clicks?: number | null;
  cpm?: number | null;
  cpc?: number | null;
  ctr?: number | null;
  roas?: number | null;
  purchases?: number | null;
  purchase_value?: number | null;
  insights_currency?: string | null;
  insights_date_preset?: string | null;
}

export interface FilterState {
  selectedBrands: string[];
  minReach: number;
  maxReach: number;
  mediaType: 'all' | 'video' | 'image';
  minSpend?: number;
  maxSpend?: number;
  minRoas?: number;
  maxRoas?: number;
  datePreset?: string;
}


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

/** Row shape for Supabase performance_insights table (and get-performance-insights API response). */
export interface PerformanceInsight {
  ad_id: string;
  account_id?: string | null;
  name?: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  cpm: number;
  cpc: number;
  ctr: number;
  purchases: number;
  purchase_value: number;
  roas: number | null;
  currency?: string | null;
  date_preset?: string | null;
  fetched_at?: string | null;
}


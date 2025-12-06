export interface AdData {
  id: string;
  page_name: string;
  reach: number;
  ad_library_url: string;
  video_url: string;
  thumbnail: string;
  heading: string;
  ad_copy: string;
}

export interface FilterState {
  selectedBrands: string[];
  minReach: number;
  maxReach: number;
  mediaType: 'all' | 'video' | 'image';
}
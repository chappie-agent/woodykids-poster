export interface Session {
  id: string;
  product_ids: string[];
  images: ImageData[];
  caption_options: CaptionOptions;
  status: 'pending' | 'scheduled' | 'published';
  created_at: string;
  updated_at: string;
}

export interface ImageData {
  id: string;
  url: string;
  product_id: string;
  alt_text?: string;
}

export interface CaptionOptions {
  openers: string[];
  bodies: string[];
  closers: string[];
  hashtags: string[];
}

export interface Post {
  id: string;
  session_id: string;
  caption: string;
  image_urls: string[];
  platforms: string[];
  scheduled_for: string;
  timezone: string;
  zernio_post_id?: string;
  status: 'scheduled' | 'published' | 'failed';
  created_at: string;
  updated_at: string;
}

export interface ScheduleRequest {
  session_id: string;
  caption: string;
  image_urls: string[];
  platforms: string[];
  scheduled_for: string;
  timezone: string;
}

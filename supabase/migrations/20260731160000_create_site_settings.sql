-- Create site_settings table for admin-configurable social links and global settings
CREATE TABLE IF NOT EXISTS site_settings (
  id text PRIMARY KEY DEFAULT 'default',
  twitter_url text,
  youtube_url text,
  instagram_url text,
  facebook_url text,
  telegram_url text,
  updated_at timestamptz DEFAULT now()
);

-- Insert default row if not exists
INSERT INTO site_settings (id, twitter_url, youtube_url, instagram_url, facebook_url, telegram_url)
VALUES (
  'default',
  'https://x.com/jobalertin',
  'https://youtube.com/@jobalertin',
  'https://instagram.com/jobalertin',
  'https://facebook.com/jobalertin',
  'https://t.me/jobalertin'
)
ON CONFLICT (id) DO NOTHING;

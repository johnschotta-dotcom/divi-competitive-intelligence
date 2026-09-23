-- Optional company social URLs used when no team roster is found
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS linkedin_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS twitter_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS facebook_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS instagram_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS youtube_url TEXT;

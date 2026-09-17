-- Divi Competitive Intelligence — Deep Profiles
-- Run this in the Supabase SQL Editor after 01_DATABASE_SCHEMA.sql
-- Safe to re-run: uses IF NOT EXISTS / additive alters where possible

-- Extend competitors with profile metadata
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255);
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS employee_estimate VARCHAR(100);
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS revenue_estimate VARCHAR(100);
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS total_funding_display VARCHAR(100);
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS sentiment_score INT;
ALTER TABLE competitors ADD COLUMN IF NOT EXISTS tagline TEXT;

-- Extend competitor_profiles if table exists (created by earlier agent runs)
CREATE TABLE IF NOT EXISTS competitor_profiles (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  overall_summary TEXT,
  target_audience TEXT,
  primary_value_prop TEXT,
  business_model TEXT,
  funding_status TEXT,
  team_size_estimate INT,
  risk_score INT,
  threat_to_divi VARCHAR(50),
  company_history_summary TEXT,
  revenue_estimate VARCHAR(100),
  founded_year INT,
  headquarters VARCHAR(255),
  analyzed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(competitor_id)
);

ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS company_history_summary TEXT;
ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS revenue_estimate VARCHAR(100);
ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS founded_year INT;
ALTER TABLE competitor_profiles ADD COLUMN IF NOT EXISTS headquarters VARCHAR(255);

CREATE TABLE IF NOT EXISTS competitor_strengths (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  strength_title VARCHAR(255),
  description TEXT,
  why_its_strong TEXT,
  competitive_advantage_level VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS competitor_weaknesses (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  weakness_title VARCHAR(255),
  description TEXT,
  why_its_weak TEXT,
  opportunity_level VARCHAR(50),
  divi_advantage TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_score_breakdown (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  funding_risk INT,
  team_risk INT,
  feature_risk INT,
  market_fit_risk INT,
  growth_risk INT,
  funding_notes TEXT,
  team_notes TEXT,
  feature_notes TEXT,
  market_notes TEXT,
  growth_notes TEXT,
  calculated_risk_score INT,
  UNIQUE(competitor_id)
);

-- Founders / leadership
CREATE TABLE IF NOT EXISTS competitor_founders (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  title VARCHAR(255),
  linkedin_url TEXT,
  twitter_url TEXT,
  bio TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Funding rounds (estimates allowed)
CREATE TABLE IF NOT EXISTS funding_rounds (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  round_name VARCHAR(100),
  amount_display VARCHAR(100),
  announced_date VARCHAR(50),
  lead_investors TEXT,
  is_estimate BOOLEAN DEFAULT TRUE,
  source TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Company history timeline
CREATE TABLE IF NOT EXISTS company_history (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  event_date VARCHAR(50),
  title VARCHAR(255),
  description TEXT,
  event_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Social / market sentiment snapshot
CREATE TABLE IF NOT EXISTS social_sentiment (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  score INT CHECK (score >= 0 AND score <= 100),
  summary TEXT,
  positive_themes TEXT,
  negative_themes TEXT,
  sample_sources TEXT,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(competitor_id)
);

-- Press / media mentions (from Google News RSS + Claude)
CREATE TABLE IF NOT EXISTS media_mentions (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  title TEXT,
  source_name VARCHAR(255),
  url TEXT,
  published_at VARCHAR(100),
  sentiment VARCHAR(50),
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Detected / inferred tech stack
CREATE TABLE IF NOT EXISTS tech_stack (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  category VARCHAR(100),
  technology VARCHAR(255),
  confidence VARCHAR(50),
  evidence TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- DIVI vs competitor comparison
CREATE TABLE IF NOT EXISTS divi_comparisons (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  overall_verdict TEXT,
  divi_wins JSONB DEFAULT '[]'::jsonb,
  competitor_wins JSONB DEFAULT '[]'::jsonb,
  feature_matrix JSONB DEFAULT '[]'::jsonb,
  strategic_recommendation TEXT,
  analyzed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(competitor_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_founders_competitor ON competitor_founders(competitor_id);
CREATE INDEX IF NOT EXISTS idx_funding_competitor ON funding_rounds(competitor_id);
CREATE INDEX IF NOT EXISTS idx_history_competitor ON company_history(competitor_id);
CREATE INDEX IF NOT EXISTS idx_media_competitor ON media_mentions(competitor_id);
CREATE INDEX IF NOT EXISTS idx_tech_competitor ON tech_stack(competitor_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_competitor ON social_sentiment(competitor_id);
CREATE INDEX IF NOT EXISTS idx_comparisons_competitor ON divi_comparisons(competitor_id);

-- RLS: open read/write for anon key (matches existing project pattern)
ALTER TABLE competitor_founders ENABLE ROW LEVEL SECURITY;
ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_sentiment ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tech_stack ENABLE ROW LEVEL SECURITY;
ALTER TABLE divi_comparisons ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_strengths ENABLE ROW LEVEL SECURITY;
ALTER TABLE competitor_weaknesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_score_breakdown ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- competitors extras already have policies from base schema
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_founders_all' AND tablename = 'competitor_founders') THEN
    CREATE POLICY deep_founders_all ON competitor_founders FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_funding_all' AND tablename = 'funding_rounds') THEN
    CREATE POLICY deep_funding_all ON funding_rounds FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_history_all' AND tablename = 'company_history') THEN
    CREATE POLICY deep_history_all ON company_history FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_sentiment_all' AND tablename = 'social_sentiment') THEN
    CREATE POLICY deep_sentiment_all ON social_sentiment FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_media_all' AND tablename = 'media_mentions') THEN
    CREATE POLICY deep_media_all ON media_mentions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_tech_all' AND tablename = 'tech_stack') THEN
    CREATE POLICY deep_tech_all ON tech_stack FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_comparisons_all' AND tablename = 'divi_comparisons') THEN
    CREATE POLICY deep_comparisons_all ON divi_comparisons FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_profiles_all' AND tablename = 'competitor_profiles') THEN
    CREATE POLICY deep_profiles_all ON competitor_profiles FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_strengths_all' AND tablename = 'competitor_strengths') THEN
    CREATE POLICY deep_strengths_all ON competitor_strengths FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_weaknesses_all' AND tablename = 'competitor_weaknesses') THEN
    CREATE POLICY deep_weaknesses_all ON competitor_weaknesses FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'deep_risk_all' AND tablename = 'risk_score_breakdown') THEN
    CREATE POLICY deep_risk_all ON risk_score_breakdown FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

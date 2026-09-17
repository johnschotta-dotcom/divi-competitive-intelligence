-- Divi Competitive Intelligence System
-- Deploy this SQL in Supabase SQL Editor

-- 1. COMPETITORS TABLE
CREATE TABLE competitors (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  website VARCHAR(500),
  category VARCHAR(100),
  tier VARCHAR(50), -- 'critical', 'high', 'medium', 'emerging', 'monitor'
  threat_score INT DEFAULT 50, -- 0-100 scale
  status VARCHAR(50) DEFAULT 'active', -- 'active', 'emerging', 'defunct'
  description TEXT,
  founded_year INT,
  funding_raised VARCHAR(100),
  team_size INT,
  pricing_model TEXT,
  last_checked TIMESTAMP,
  last_analyzed TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  manual_entry BOOLEAN DEFAULT FALSE -- TRUE if user added manually
);

-- 2. FEATURES TABLE (track what each competitor offers)
CREATE TABLE features (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  feature_name VARCHAR(255),
  description TEXT,
  detected_date TIMESTAMP DEFAULT NOW(),
  removed_date TIMESTAMP,
  verified BOOLEAN DEFAULT FALSE, -- FALSE = auto-detected, TRUE = manually verified
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. PRICING TABLE (track pricing changes over time)
CREATE TABLE pricing (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  tier_name VARCHAR(100),
  price DECIMAL(10, 2),
  billing_cycle VARCHAR(50), -- 'monthly', 'annual', 'one-time'
  currency VARCHAR(10) DEFAULT 'USD',
  description TEXT,
  detected_date TIMESTAMP DEFAULT NOW(),
  is_current BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 4. CHANGES TABLE (log of what changed and when)
CREATE TABLE changes (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  change_type VARCHAR(50), -- 'pricing', 'feature', 'funding', 'threat_level', 'team_size'
  old_value TEXT,
  new_value TEXT,
  detected_date TIMESTAMP DEFAULT NOW(),
  manual_review_required BOOLEAN DEFAULT FALSE,
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. ALERTS TABLE (notifications of important changes)
CREATE TABLE alerts (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  alert_type VARCHAR(100), -- 'new_feature', 'price_change', 'funding', 'threat_escalation', 'new_competitor'
  severity VARCHAR(50), -- 'critical', 'high', 'medium', 'low'
  message TEXT,
  change_id BIGINT REFERENCES changes(id),
  dismissed BOOLEAN DEFAULT FALSE,
  dismissed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 6. THREAT_SCORES TABLE (historical tracking of threat level changes)
CREATE TABLE threat_scores (
  id BIGSERIAL PRIMARY KEY,
  competitor_id BIGINT REFERENCES competitors(id) ON DELETE CASCADE,
  score INT,
  reason TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 7. VETTING_QUEUE TABLE (new competitors awaiting review)
CREATE TABLE vetting_queue (
  id BIGSERIAL PRIMARY KEY,
  competitor_name VARCHAR(255),
  website VARCHAR(500),
  discovery_source VARCHAR(100), -- 'web_search', 'manual', 'twitter', 'producthunt'
  discovery_context TEXT,
  claude_analysis TEXT, -- Claude's initial assessment
  confidence_score DECIMAL(3, 2), -- 0.0 to 1.0
  recommended_tier VARCHAR(50),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  reviewed_by VARCHAR(255),
  reviewed_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for faster queries
CREATE INDEX idx_competitors_tier ON competitors(tier);
CREATE INDEX idx_competitors_status ON competitors(status);
CREATE INDEX idx_competitors_threat_score ON competitors(threat_score);
CREATE INDEX idx_features_competitor_id ON features(competitor_id);
CREATE INDEX idx_pricing_competitor_id ON pricing(competitor_id);
CREATE INDEX idx_changes_competitor_id ON changes(competitor_id);
CREATE INDEX idx_alerts_competitor_id ON alerts(competitor_id);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_vetting_queue_status ON vetting_queue(status);

-- Enable Row Level Security (optional but recommended)
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE features ENABLE ROW LEVEL SECURITY;
ALTER TABLE pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE threat_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE vetting_queue ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all authenticated users to read/write (you can restrict later)
CREATE POLICY "Enable read access for all users" ON competitors FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON competitors FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON competitors FOR UPDATE USING (true);

CREATE POLICY "Enable read access for all users" ON features FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON features FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON pricing FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON pricing FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON changes FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON changes FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON alerts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON threat_scores FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON threat_scores FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable read access for all users" ON vetting_queue FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON vetting_queue FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON vetting_queue FOR UPDATE USING (true);

-- Procura Ops Command Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE opportunity_status AS ENUM ('new', 'reviewing', 'qualified', 'disqualified', 'submitted');
CREATE TYPE submission_status AS ENUM ('draft', 'pending_approval', 'approved', 'submitted', 'rejected');
CREATE TYPE approval_status AS ENUM ('pending', 'legal_approved', 'finance_approved', 'complete', 'rejected');
CREATE TYPE connector_status AS ENUM ('active', 'warning', 'revoked');
CREATE TYPE run_status AS ENUM ('pending', 'running', 'success', 'failed');
CREATE TYPE user_role AS ENUM ('admin', 'contract_officer', 'viewer');

-- ===========================================
-- CORE TABLES
-- ===========================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'viewer',
  department TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ
);

-- Opportunities discovered from various sources
CREATE TABLE opportunities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_ref TEXT UNIQUE NOT NULL,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  description TEXT,
  naics_code TEXT,
  set_aside TEXT,
  posted_date DATE NOT NULL,
  due_date DATE NOT NULL,
  estimated_value NUMERIC,
  -- AI Qualification Scores
  fit_score INTEGER CHECK (fit_score >= 0 AND fit_score <= 100),
  effort_score INTEGER CHECK (effort_score >= 0 AND effort_score <= 100),
  urgency_score INTEGER CHECK (urgency_score >= 0 AND urgency_score <= 100),
  ai_summary TEXT,
  -- Status
  status opportunity_status DEFAULT 'new',
  disqualified_reason TEXT,
  -- Metadata
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_opportunities_due_date ON opportunities(due_date);
CREATE INDEX idx_opportunities_fit_score ON opportunities(fit_score DESC);
CREATE INDEX idx_opportunities_status ON opportunities(status);
CREATE INDEX idx_opportunities_source ON opportunities(source);

-- Submissions (proposal workspaces)
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES profiles(id),
  title TEXT NOT NULL,
  portal TEXT NOT NULL,
  status submission_status DEFAULT 'draft',
  approval_status approval_status DEFAULT 'pending',
  due_date DATE NOT NULL,
  estimated_value NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_submissions_owner ON submissions(owner_id);
CREATE INDEX idx_submissions_status ON submissions(status);

-- Submission files/artifacts
CREATE TABLE submission_files (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  scan_status TEXT DEFAULT 'pending',
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Submission checklist tasks
CREATE TABLE submission_tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subtitle TEXT,
  completed BOOLEAN DEFAULT FALSE,
  locked BOOLEAN DEFAULT FALSE,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Portal connectors (credentials + config)
CREATE TABLE connectors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  label TEXT,
  portal_url TEXT,
  auth_type TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  status connector_status DEFAULT 'active',
  schedule_cron TEXT,
  rate_limit_per_min INTEGER DEFAULT 60,
  last_run_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovery run logs
CREATE TABLE discovery_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connector_id UUID REFERENCES connectors(id) ON DELETE SET NULL,
  connector_name TEXT NOT NULL,
  run_type TEXT NOT NULL,
  status run_status DEFAULT 'pending',
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  records_fetched INTEGER DEFAULT 0,
  opportunities_created INTEGER DEFAULT 0,
  opportunities_updated INTEGER DEFAULT 0,
  errors INTEGER DEFAULT 0,
  error_message TEXT,
  triggered_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_discovery_runs_connector ON discovery_runs(connector_id);
CREATE INDEX idx_discovery_runs_status ON discovery_runs(status);

-- Submission automation runs (OpenManus)
CREATE TABLE submission_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  agent_type TEXT DEFAULT 'openmanus',
  status run_status DEFAULT 'pending',
  current_step TEXT,
  start_time TIMESTAMPTZ DEFAULT NOW(),
  end_time TIMESTAMPTZ,
  duration_ms INTEGER,
  receipt_id TEXT,
  confirmation_number TEXT,
  screenshot_paths TEXT[],
  log_output TEXT,
  error_message TEXT,
  triggered_by UUID REFERENCES profiles(id)
);

-- Audit logs (cryptographically signed)
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id),
  submission_ref TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  portal TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL,
  receipt_id TEXT,
  confirmation_hash TEXT NOT NULL,
  evidence_urls TEXT[],
  metadata JSONB,
  created_by UUID REFERENCES profiles(id)
);

CREATE INDEX idx_audit_logs_submission ON audit_logs(submission_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Approval workflow steps
CREATE TABLE approval_workflows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  approver_id UUID REFERENCES profiles(id),
  approver_role user_role,
  status TEXT DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_approval_workflows_submission ON approval_workflows(submission_id);

-- LLM response cache
CREATE TABLE llm_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE CASCADE,
  prompt_hash TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  response JSONB NOT NULL,
  tokens_used INTEGER,
  cost_usd NUMERIC(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_llm_cache_hash ON llm_cache(prompt_hash);
CREATE INDEX idx_llm_cache_opportunity ON llm_cache(opportunity_id);

-- System settings
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES profiles(id)
);

-- Insert default settings
INSERT INTO system_settings (key, value) VALUES
  ('autonomy_mode', '{"enabled": true, "threshold_usd": 100000}'),
  ('llm_provider', '{"primary": "anthropic", "fallback": "openai", "model": "claude-3-5-sonnet-20241022"}'),
  ('discovery_schedule', '{"default_interval_minutes": 15}');

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_opportunities_updated_at BEFORE UPDATE ON opportunities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_submissions_updated_at BEFORE UPDATE ON submissions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_connectors_updated_at BEFORE UPDATE ON connectors
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Handle new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'viewer'
  );
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

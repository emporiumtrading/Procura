-- Procura Ops Command - Row Level Security Policies
-- Run after 01_schema.sql

-- ===========================================
-- ENABLE RLS ON ALL TABLES
-- ===========================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE discovery_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE llm_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- ===========================================
-- HELPER FUNCTIONS
-- ===========================================

-- Get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ===========================================
-- PROFILES POLICIES
-- ===========================================

-- Users can view all profiles (for collaboration)
CREATE POLICY "Profiles viewable by authenticated users"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ===========================================
-- OPPORTUNITIES POLICIES
-- ===========================================

-- All authenticated users can view opportunities
CREATE POLICY "Opportunities viewable by authenticated users"
  ON opportunities FOR SELECT
  TO authenticated
  USING (true);

-- Only admins and contract officers can create opportunities
CREATE POLICY "Admins and officers can create opportunities"
  ON opportunities FOR INSERT
  TO authenticated
  WITH CHECK (get_user_role() IN ('admin', 'contract_officer'));

-- Only admins and contract officers can update opportunities
CREATE POLICY "Admins and officers can update opportunities"
  ON opportunities FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'contract_officer'))
  WITH CHECK (get_user_role() IN ('admin', 'contract_officer'));

-- ===========================================
-- SUBMISSIONS POLICIES
-- ===========================================

-- Users can view submissions they own or if admin
CREATE POLICY "Submissions viewable by owner or admin"
  ON submissions FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin());

-- Users can create submissions
CREATE POLICY "Authenticated users can create submissions"
  ON submissions FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own submissions
CREATE POLICY "Users can update own submissions"
  ON submissions FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid() OR is_admin())
  WITH CHECK (owner_id = auth.uid() OR is_admin());

-- ===========================================
-- SUBMISSION FILES POLICIES
-- ===========================================

-- View files if can view parent submission
CREATE POLICY "Files viewable by submission owner or admin"
  ON submission_files FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND (s.owner_id = auth.uid() OR is_admin())
    )
  );

-- Upload files if own the submission
CREATE POLICY "Users can upload to own submissions"
  ON submission_files FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND s.owner_id = auth.uid()
    )
  );

-- Delete files from own submissions
CREATE POLICY "Users can delete from own submissions"
  ON submission_files FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_files.submission_id
      AND s.owner_id = auth.uid()
    )
  );

-- ===========================================
-- CONNECTORS POLICIES (Admin Only)
-- ===========================================

-- Only admins can view connectors
CREATE POLICY "Connectors viewable by admins"
  ON connectors FOR SELECT
  TO authenticated
  USING (is_admin());

-- Only admins can manage connectors
CREATE POLICY "Connectors managed by admins"
  ON connectors FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ===========================================
-- DISCOVERY RUNS POLICIES
-- ===========================================

-- All authenticated can view run history
CREATE POLICY "Discovery runs viewable by authenticated"
  ON discovery_runs FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can create/manage runs
CREATE POLICY "Discovery runs managed by admins"
  ON discovery_runs FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ===========================================
-- AUDIT LOGS POLICIES
-- ===========================================

-- Audit logs viewable by admins and submission owners
CREATE POLICY "Audit logs viewable by owner or admin"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    is_admin() OR
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = audit_logs.submission_id
      AND s.owner_id = auth.uid()
    )
  );

-- Audit logs can only be created by system (service role)
-- No INSERT policy for authenticated - use service role key in backend

-- ===========================================
-- SYSTEM SETTINGS POLICIES (Admin Only)
-- ===========================================

CREATE POLICY "Settings viewable by admins"
  ON system_settings FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Settings managed by admins"
  ON system_settings FOR ALL
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ===========================================
-- LLM CACHE POLICIES
-- ===========================================

-- Cache viewable by authenticated (for debugging)
CREATE POLICY "LLM cache viewable by authenticated"
  ON llm_cache FOR SELECT
  TO authenticated
  USING (true);

-- Cache managed by service role only (backend creates entries)

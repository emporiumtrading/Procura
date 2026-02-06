-- =====================================================
-- Migration 06: Missing indexes, FK constraints, RLS policies
-- Addresses critical findings from MCR security analysis
-- =====================================================

-- ===========================================
-- MISSING INDEXES
-- submission_files and submission_tasks are frequently
-- queried by submission_id but had no index.
-- ===========================================

CREATE INDEX IF NOT EXISTS idx_submission_files_submission
  ON submission_files(submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_tasks_submission
  ON submission_tasks(submission_id);

CREATE INDEX IF NOT EXISTS idx_submission_runs_submission
  ON submission_runs(submission_id);

-- ===========================================
-- MISSING FK CONSTRAINT
-- submissions.owner_id had no ON DELETE behaviour,
-- meaning orphaned submissions if a profile is removed.
-- ===========================================

-- Drop the existing FK and recreate with ON DELETE SET NULL
-- so submissions remain (for audit) but owner is cleared.
ALTER TABLE submissions
  DROP CONSTRAINT IF EXISTS submissions_owner_id_fkey;

ALTER TABLE submissions
  ADD CONSTRAINT submissions_owner_id_fkey
  FOREIGN KEY (owner_id) REFERENCES profiles(id)
  ON DELETE SET NULL;

-- ===========================================
-- MISSING RLS POLICIES
-- submission_runs and approval_workflows had RLS enabled
-- but lacked explicit SELECT/INSERT/UPDATE policies for
-- non-admin roles, making them inaccessible via RLS.
-- ===========================================

-- submission_runs: viewable by submission owner or admin
CREATE POLICY "Submission runs viewable by owner or admin"
  ON submission_runs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_runs.submission_id
      AND (s.owner_id = auth.uid() OR is_admin())
    )
  );

-- submission_runs: insertable by officers (for finalize)
CREATE POLICY "Officers can create submission runs"
  ON submission_runs FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'contract_officer')
  );

-- submission_runs: updatable by officers (for status updates)
CREATE POLICY "Officers can update submission runs"
  ON submission_runs FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'contract_officer'))
  WITH CHECK (get_user_role() IN ('admin', 'contract_officer'));

-- approval_workflows: viewable by submission owner or admin
CREATE POLICY "Approval workflows viewable by owner or admin"
  ON approval_workflows FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = approval_workflows.submission_id
      AND (s.owner_id = auth.uid() OR is_admin())
    )
  );

-- approval_workflows: insertable by officers
CREATE POLICY "Officers can create approval workflows"
  ON approval_workflows FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'contract_officer')
  );

-- approval_workflows: updatable by officers (for approve/reject)
CREATE POLICY "Officers can update approval workflows"
  ON approval_workflows FOR UPDATE
  TO authenticated
  USING (get_user_role() IN ('admin', 'contract_officer'))
  WITH CHECK (get_user_role() IN ('admin', 'contract_officer'));

-- submission_tasks: add missing UPDATE policy for task completion
CREATE POLICY "Users can update tasks on own submissions"
  ON submission_tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_tasks.submission_id
      AND (s.owner_id = auth.uid() OR is_admin())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_tasks.submission_id
      AND (s.owner_id = auth.uid() OR is_admin())
    )
  );

-- submission_tasks: add INSERT policy for task creation during submission setup
CREATE POLICY "Officers can create submission tasks"
  ON submission_tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    get_user_role() IN ('admin', 'contract_officer')
  );

-- =====================================================
-- Migration complete
-- =====================================================

-- Migration: Add proposal_sections JSONB column to submissions
-- Stores AI-generated proposal sections keyed by section name.
-- Gracefully skips if column already exists.

ALTER TABLE submissions
ADD COLUMN IF NOT EXISTS proposal_sections JSONB DEFAULT '{}';

COMMENT ON COLUMN submissions.proposal_sections IS
  'AI-generated proposal sections. Keys: cover_letter, executive_summary, technical_approach, management_plan, past_performance. Each value: {content: str, status: generated|error}.';

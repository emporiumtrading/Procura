-- =====================================================
-- Migration 05: Document Library, Follow-ups, Correspondence
-- Adds reusable document storage, application tracking,
-- and contract award/correspondence handling.
-- =====================================================

-- ===========================================
-- ENUMS
-- ===========================================

CREATE TYPE follow_up_status AS ENUM (
  'pending', 'checked', 'updated', 'no_change', 'awarded', 'lost', 'cancelled'
);

CREATE TYPE correspondence_type AS ENUM (
  'award_notice', 'rejection_notice', 'amendment', 'question',
  'clarification', 'extension', 'cancellation', 'general'
);

CREATE TYPE correspondence_status AS ENUM (
  'new', 'read', 'action_required', 'responded', 'archived'
);

CREATE TYPE document_category AS ENUM (
  'capability_statement', 'past_performance', 'pricing_template',
  'technical_proposal', 'management_plan', 'resume', 'certification',
  'sf330', 'sf1449', 'cover_letter', 'teaming_agreement', 'other'
);

-- ===========================================
-- DOCUMENT LIBRARY (reusable across submissions)
-- ===========================================

CREATE TABLE document_library (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Metadata
  name TEXT NOT NULL,
  description TEXT,
  category document_category DEFAULT 'other',
  tags TEXT[] DEFAULT '{}',
  -- File storage
  file_name TEXT NOT NULL,
  file_size BIGINT,
  file_type TEXT,
  storage_path TEXT NOT NULL,
  -- Versioning
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES document_library(id) ON DELETE SET NULL,
  is_latest BOOLEAN DEFAULT TRUE,
  -- Usage tracking
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  -- AI-extracted metadata
  ai_summary TEXT,
  ai_keywords TEXT[],
  -- Ownership
  uploaded_by UUID REFERENCES profiles(id),
  organization_id UUID,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_doc_library_category ON document_library(category);
CREATE INDEX idx_doc_library_tags ON document_library USING GIN(tags);
CREATE INDEX idx_doc_library_name ON document_library(name);
CREATE INDEX idx_doc_library_latest ON document_library(is_latest) WHERE is_latest = TRUE;

-- Junction table: which documents are used in which submissions
CREATE TABLE submission_document_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  document_id UUID REFERENCES document_library(id) ON DELETE CASCADE,
  linked_by UUID REFERENCES profiles(id),
  linked_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  UNIQUE(submission_id, document_id)
);

CREATE INDEX idx_sub_doc_links_submission ON submission_document_links(submission_id);
CREATE INDEX idx_sub_doc_links_document ON submission_document_links(document_id);

-- ===========================================
-- APPLICATION FOLLOW-UPS & TRACKING
-- ===========================================

CREATE TABLE follow_ups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- What we're tracking
  submission_id UUID REFERENCES submissions(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  -- Follow-up details
  status follow_up_status DEFAULT 'pending',
  check_type TEXT NOT NULL DEFAULT 'status_check', -- status_check, deadline_extension, amendment, award_check
  -- Scheduling
  next_check_at TIMESTAMPTZ NOT NULL,
  check_interval_hours INTEGER DEFAULT 24,
  max_checks INTEGER DEFAULT 30,
  checks_performed INTEGER DEFAULT 0,
  -- Results
  last_checked_at TIMESTAMPTZ,
  last_result JSONB,
  portal_status TEXT,
  -- Who / what is tracking
  assigned_to UUID REFERENCES profiles(id),
  auto_check BOOLEAN DEFAULT TRUE,
  -- AI analysis of changes
  ai_change_summary TEXT,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_ups_submission ON follow_ups(submission_id);
CREATE INDEX idx_follow_ups_status ON follow_ups(status);
CREATE INDEX idx_follow_ups_next_check ON follow_ups(next_check_at) WHERE status = 'pending' OR status = 'checked';

-- Follow-up check history (each time we check)
CREATE TABLE follow_up_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follow_up_id UUID REFERENCES follow_ups(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL, -- automated, manual
  -- Results
  status_found TEXT,
  changes_detected BOOLEAN DEFAULT FALSE,
  details JSONB,
  screenshot_path TEXT,
  -- AI analysis
  ai_analysis TEXT,
  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_follow_up_checks_follow_up ON follow_up_checks(follow_up_id);
CREATE INDEX idx_follow_up_checks_date ON follow_up_checks(checked_at DESC);

-- ===========================================
-- CORRESPONDENCE / AWARD TRACKING
-- ===========================================

CREATE TABLE correspondence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- Links
  submission_id UUID REFERENCES submissions(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES opportunities(id) ON DELETE SET NULL,
  -- Message details
  type correspondence_type DEFAULT 'general',
  status correspondence_status DEFAULT 'new',
  subject TEXT NOT NULL,
  body TEXT,
  -- Source
  source TEXT, -- email, portal_notification, manual, ai_detected
  source_ref TEXT, -- email message-id, portal notification id, etc.
  sender TEXT,
  received_at TIMESTAMPTZ,
  -- Award-specific fields
  award_amount NUMERIC,
  contract_number TEXT,
  period_of_performance_start DATE,
  period_of_performance_end DATE,
  -- AI processing
  ai_summary TEXT,
  ai_suggested_actions JSONB,
  ai_sentiment TEXT, -- positive, neutral, negative
  -- Response tracking
  responded_at TIMESTAMPTZ,
  responded_by UUID REFERENCES profiles(id),
  response_notes TEXT,
  -- Attachments
  attachment_paths TEXT[],
  -- Ownership
  created_by UUID REFERENCES profiles(id),
  assigned_to UUID REFERENCES profiles(id),
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_correspondence_submission ON correspondence(submission_id);
CREATE INDEX idx_correspondence_opportunity ON correspondence(opportunity_id);
CREATE INDEX idx_correspondence_type ON correspondence(type);
CREATE INDEX idx_correspondence_status ON correspondence(status);
CREATE INDEX idx_correspondence_received ON correspondence(received_at DESC);

-- ===========================================
-- NOTIFICATION QUEUE (for AI-generated follow-ups)
-- ===========================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  -- Content
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL, -- award, deadline, follow_up, correspondence, system
  priority TEXT DEFAULT 'normal', -- low, normal, high, urgent
  -- Links
  entity_type TEXT, -- submission, opportunity, correspondence, follow_up
  entity_id UUID,
  action_url TEXT,
  -- Status
  read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  dismissed BOOLEAN DEFAULT FALSE,
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_unread ON notifications(user_id, read) WHERE read = FALSE;
CREATE INDEX idx_notifications_type ON notifications(type);

-- ===========================================
-- RLS POLICIES
-- ===========================================

ALTER TABLE document_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE submission_document_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_ups ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE correspondence ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Document library: authenticated users can read, officers+ can write
CREATE POLICY "Authenticated users can view documents" ON document_library
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Officers can manage documents" ON document_library
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- Submission document links: follow submission access rules
CREATE POLICY "Users can view their submission doc links" ON submission_document_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM submissions s
      WHERE s.id = submission_document_links.submission_id
      AND (s.owner_id = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Officers can manage submission doc links" ON submission_document_links
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- Follow-ups: owner or admin
CREATE POLICY "Users can view their follow-ups" ON follow_ups
  FOR SELECT USING (
    assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM submissions s WHERE s.id = follow_ups.submission_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Officers can manage follow-ups" ON follow_ups
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- Follow-up checks: same as follow-ups
CREATE POLICY "Users can view follow-up checks" ON follow_up_checks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM follow_ups fu
      WHERE fu.id = follow_up_checks.follow_up_id
      AND (fu.assigned_to = auth.uid() OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Officers can manage follow-up checks" ON follow_up_checks
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- Correspondence: submission owner or admin
CREATE POLICY "Users can view their correspondence" ON correspondence
  FOR SELECT USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
    OR EXISTS (
      SELECT 1 FROM submissions s WHERE s.id = correspondence.submission_id AND s.owner_id = auth.uid()
    )
  );

CREATE POLICY "Officers can manage correspondence" ON correspondence
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- Notifications: users can only see their own
CREATE POLICY "Users can view own notifications" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "System can create notifications" ON notifications
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'contract_officer'))
  );

-- ===========================================
-- TRIGGERS
-- ===========================================

CREATE TRIGGER update_document_library_updated_at BEFORE UPDATE ON document_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_follow_ups_updated_at BEFORE UPDATE ON follow_ups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_correspondence_updated_at BEFORE UPDATE ON correspondence
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- Migration complete
-- ===========================================

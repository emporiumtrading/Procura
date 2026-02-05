-- =====================================================
-- Procura Admin Tables Migration
-- Run AFTER 01_schema.sql and 02_rls_policies.sql
-- =====================================================

-- Feature Flags Table
CREATE TABLE IF NOT EXISTS public.feature_flags (
    key TEXT PRIMARY KEY,
    enabled BOOLEAN NOT NULL DEFAULT false,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Feature Flags
INSERT INTO public.feature_flags (key, enabled, description) VALUES
    ('discovery_enabled', true, 'Enable automated opportunity discovery'),
    ('ai_qualification', true, 'Use AI to score and qualify opportunities'),
    ('browser_automation', false, 'Enable OpenManus for automated submission'),
    ('autonomy_mode', false, 'Auto-approve submissions under threshold'),
    ('email_notifications', true, 'Send email alerts for important events'),
    ('maintenance_mode', false, 'Put application in maintenance mode')
ON CONFLICT (key) DO NOTHING;

-- Email Templates Table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    variables JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Email Templates
INSERT INTO public.email_templates (name, subject, body, variables) VALUES
    ('welcome', 'Welcome to Procura', 'Hello {{name}}, Welcome to the Procura platform!', '["name"]'),
    ('opportunity_alert', 'New Opportunity: {{title}}', 'A new opportunity has been discovered: {{title}} from {{agency}}. Due date: {{due_date}}', '["title", "agency", "due_date"]'),
    ('approval_needed', 'Approval Required: {{submission_title}}', 'Submission {{submission_title}} requires your approval. Please review.', '["submission_title"]'),
    ('deadline_reminder', 'Deadline Approaching: {{title}}', 'Reminder: {{title}} is due in {{days_remaining}} days.', '["title", "days_remaining"]')
ON CONFLICT (name) DO NOTHING;

-- Alert Rules Table
CREATE TABLE IF NOT EXISTS public.alert_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    event_type TEXT NOT NULL, -- discovery_failed, deadline_approaching, submission_complete
    condition JSONB DEFAULT '{}'::jsonb,
    action TEXT NOT NULL, -- email, webhook, in_app
    recipients JSONB DEFAULT '[]'::jsonb,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Alert Rules
INSERT INTO public.alert_rules (name, event_type, condition, action, recipients, enabled) VALUES
    ('Discovery Failure Alert', 'discovery_failed', '{"threshold": 3}', 'email', '["admin"]', true),
    ('Deadline 7 Day Warning', 'deadline_approaching', '{"days": 7}', 'email', '["owner", "admin"]', true),
    ('Submission Complete', 'submission_complete', '{}', 'email', '["owner"]', true)
ON CONFLICT DO NOTHING;

-- API Keys Table (for external integrations)
CREATE TABLE IF NOT EXISTS public.api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    key_hash TEXT NOT NULL, -- Store hash, not actual key
    key_prefix TEXT NOT NULL, -- First 8 chars for identification
    permissions JSONB DEFAULT '["read"]'::jsonb,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES public.profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE
);

-- Scheduled Tasks Configuration
CREATE TABLE IF NOT EXISTS public.scheduled_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    task_type TEXT NOT NULL, -- discovery, cleanup, report
    schedule TEXT NOT NULL, -- cron expression
    config JSONB DEFAULT '{}'::jsonb,
    enabled BOOLEAN DEFAULT true,
    last_run_at TIMESTAMP WITH TIME ZONE,
    next_run_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Default Scheduled Tasks
INSERT INTO public.scheduled_tasks (name, task_type, schedule, config, enabled) VALUES
    ('SAM.gov Discovery', 'discovery', '*/15 * * * *', '{"source": "sam_gov"}', true),
    ('GovCon API Discovery', 'discovery', '*/15 * * * *', '{"source": "govcon_api"}', true),
    ('USAspending Discovery', 'discovery', '*/30 * * * *', '{"source": "usaspending"}', true),
    ('LLM Cache Cleanup', 'cleanup', '0 3 * * *', '{"max_age_days": 30}', true),
    ('Weekly Report', 'report', '0 9 * * 1', '{"type": "weekly_summary"}', false)
ON CONFLICT (name) DO NOTHING;

-- Branding Settings Table
CREATE TABLE IF NOT EXISTS public.branding_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    file_path TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID REFERENCES public.profiles(id)
);

-- Default Branding
INSERT INTO public.branding_settings (key, value) VALUES
    ('app_name', 'Procura'),
    ('primary_color', '#4F46E5'),
    ('secondary_color', '#7C3AED'),
    ('logo_url', NULL),
    ('favicon_url', NULL),
    ('login_message', 'Government Contract Automation Platform')
ON CONFLICT (key) DO NOTHING;

-- Activity Log Table (for detailed admin tracking)
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id),
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id UUID,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for activity logs
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON public.activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- RLS Policies for Admin Tables
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Admin-only policies
CREATE POLICY "Admin full access to feature_flags" ON public.feature_flags
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to email_templates" ON public.email_templates
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to alert_rules" ON public.alert_rules
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to api_keys" ON public.api_keys
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to scheduled_tasks" ON public.scheduled_tasks
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to branding_settings" ON public.branding_settings
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

CREATE POLICY "Admin full access to activity_logs" ON public.activity_logs
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
    );

-- Function to log admin activity
CREATE OR REPLACE FUNCTION log_admin_activity()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (auth.uid(), 'create', TG_TABLE_NAME, NEW.id, row_to_json(NEW));
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (auth.uid(), 'update', TG_TABLE_NAME, NEW.id, jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW)));
    ELSIF TG_OP = 'DELETE' THEN
        INSERT INTO public.activity_logs (user_id, action, entity_type, entity_id, details)
        VALUES (auth.uid(), 'delete', TG_TABLE_NAME, OLD.id, row_to_json(OLD));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Default system settings for admin
INSERT INTO public.system_settings (key, value) VALUES
    ('autonomy_enabled', 'false'),
    ('autonomy_threshold_usd', '50000'),
    ('discovery_interval_minutes', '15'),
    ('discovery_auto_enabled', 'true'),
    ('discovery_naics_filter', '[]'),
    ('discovery_min_value', '0'),
    ('discovery_agency_blacklist', '[]'),
    ('qualification_auto_qualify_min', '70'),
    ('qualification_auto_disqualify_max', '30'),
    ('notification_email_enabled', 'true'),
    ('notification_deadline_days', '7')
ON CONFLICT (key) DO NOTHING;

-- =====================================================
-- Migration complete
-- =====================================================

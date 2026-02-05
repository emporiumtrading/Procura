# Admin Dashboard - Complete Feature Plan

## Mission Statement
**"Zero-Code Administration"** - Once deployed, the admin should be able to control, customize, and monitor the entire platform without touching Supabase, codebase, or terminal.

---

## 📊 Admin Dashboard Structure

```
/admin
├── /dashboard          # Overview & Analytics
├── /users              # User Management
├── /discovery          # Discovery Configuration
├── /connectors         # Portal/API Management
├── /ai-config          # LLM Settings
├── /workflows          # Approval Chains
├── /security           # Security Settings
├── /audit              # Audit & Compliance
├── /notifications      # Alert Configuration
├── /system             # System Settings
├── /integrations       # External Services
├── /jobs               # Background Jobs
├── /branding           # UI Customization
└── /maintenance        # Backup & Tools
```

---

## 1. 📈 Admin Dashboard Home (`/admin/dashboard`)

### Key Metrics Cards
- Total Opportunities (new/qualified/submitted)
- Active Submissions (by status)
- Discovery Success Rate
- AI Qualification Accuracy
- System Health Score
- Active Users (online now)

### Charts & Graphs
- Opportunities Over Time (line chart)
- Submission Pipeline (funnel chart)
- Discovery by Source (pie chart)
- AI Scores Distribution (histogram)
- Response Time Trends (line chart)

### Quick Actions
- Trigger Manual Discovery
- View System Alerts
- Recent Audit Logs
- Pending Approvals

### Real-time Monitoring
- API Request Rate
- Database Connections
- Redis Queue Depth
- Error Rate (last 24h)

---

## 2. 👥 User Management (`/admin/users`)

### User List
- Search & Filter (role, status, department)
- Bulk Actions (activate, deactivate, delete)
- Export Users (CSV/JSON)

### User Actions
- Create New User (with email invite)
- Edit User Profile
- Change Role (admin, contract_officer, viewer)
- Reset Password
- Force Logout
- View Activity Log
- Impersonate User (for debugging)

### Role Management
- Create Custom Roles
- Assign Permissions per Role
- Permission Matrix View

### Invitation System
- Send Email Invites
- Pending Invitations List
- Resend/Revoke Invitations

---

## 3. 🔍 Discovery Configuration (`/admin/discovery`)

### Discovery Sources
- Enable/Disable Sources
- Configure API Endpoints
- Set Rate Limits per Source
- View Source Health Status

### Schedule Management
- Set Discovery Frequency (cron expression or simple picker)
- Configure Time Windows
- Pause/Resume Discovery
- Manual Trigger per Source

### Data Processing Rules
- Deduplication Settings
- NAICS Code Filters
- Set-Aside Preferences
- Minimum Value Threshold
- Agency Whitelist/Blacklist
- Keyword Include/Exclude

### Discovery History
- View Past Runs
- Success/Failure Statistics
- Records Fetched per Run
- Retry Failed Runs

---

## 4. 🔌 Connector Management (`/admin/connectors`)

### API Connectors
- Add New Connector
- Configure Credentials (stored encrypted)
- Test Connection
- View Connection Logs
- Rotate Credentials
- Revoke Access

### Portal Credentials (for Submission)
- Add Portal Credentials
- Credential Health Check
- Expiration Warnings
- Auto-Rotation Settings

### Connector Health
- Real-time Status
- Last Success/Failure
- Error Count & History
- Auto-disable Threshold

---

## 5. 🤖 AI Configuration (`/admin/ai-config`)

### LLM Provider Settings
- Select Primary Provider (Anthropic/OpenAI/Google)
- Configure Fallback Providers
- API Key Management (masked display)
- Test API Connection

### Model Settings
- Select Model Version
- Temperature Setting
- Max Tokens
- Response Format (JSON mode)

### Qualification Tuning
- Fit Score Weights
- Effort Score Criteria
- Urgency Calculation Method
- Score Thresholds (auto-qualify, auto-disqualify)

### Prompt Management
- View/Edit Qualification Prompt
- View/Edit Summary Prompt
- Prompt Version History
- A/B Test Prompts

### AI Cost Tracking
- Daily/Monthly Token Usage
- Cost by Provider
- Cost per Opportunity
- Budget Alerts

---

## 6. ⚙️ Workflow Configuration (`/admin/workflows`)

### Approval Chains
- Define Approval Steps
- Assign Approvers (by role or user)
- Set Required vs Optional Steps
- Skip Conditions (value threshold)

### Autonomy Mode
- Enable/Disable
- Set Value Threshold
- Configure Auto-Approve Criteria
- Risk Score Limits

### Notification Rules
- Approval Request Notifications
- Deadline Reminders
- Escalation Rules
- Out-of-Office Handling

### SLA Configuration
- Max Approval Time per Step
- Escalation after N hours
- Auto-Approve if No Response

---

## 7. 🔐 Security Settings (`/admin/security`)

### Authentication
- Session Timeout Duration
- Max Concurrent Sessions
- 2FA Configuration (future)
- SSO/SAML Settings (future)

### Password Policy
- Minimum Length
- Complexity Requirements
- Expiration Period
- History Count

### Access Control
- IP Whitelist/Blacklist
- Allowed Email Domains
- API Rate Limits per User
- Failed Login Lockout

### Encryption Settings
- View Encryption Status
- Rotate Encryption Keys (with confirmation)
- Key Expiration Alerts

### Audit Signing
- View Signing Key Status
- Integrity Verification Toggle
- Auto-Verify Schedule

---

## 8. 📋 Audit & Compliance (`/admin/audit`)

### Audit Log Viewer
- Search & Filter (date, user, action, entity)
- View Log Details
- Verify Integrity (per log)
- Bulk Integrity Check

### Export & Reports
- Export Logs (JSON/CSV)
- Generate Compliance Report
- Scheduled Report Delivery
- Report Templates

### Retention Policy
- Configure Retention Period
- Archive Old Logs
- Purge Settings (with safeguards)

### Compliance Dashboard
- Missing Audit Entries Alert
- Integrity Failures
- Access Anomalies
- Regulatory Checklist

---

## 9. 🔔 Notification Settings (`/admin/notifications`)

### Email Configuration
- SMTP Settings
- Sender Name/Email
- Test Email Connection
- Email Templates

### Alert Rules
- Discovery Failures (after N failures)
- Submission Deadlines
- Credential Expiration
- System Errors
- Low Balance Warnings

### Notification Channels
- Email (configured)
- Slack Integration (future)
- Webhook URLs
- In-App Notifications

### Templates
- Edit Email Templates
- Preview Templates
- Variables Reference

---

## 10. 🔧 System Settings (`/admin/system`)

### Application Settings
- Application Name
- Default Timezone
- Date/Time Format
- Currency Display

### Feature Flags
- Enable/Disable Features
- Beta Features Toggle
- Maintenance Mode

### Performance
- Cache Settings
- Query Timeout
- Pagination Defaults
- File Upload Limits

### Environment Info
- Current Version
- Environment (dev/staging/prod)
- Deployment Date
- Dependencies Status

---

## 11. 🔗 Integrations (`/admin/integrations`)

### External Services Status
- Supabase Connection
- Redis Connection
- OpenManus Status
- LLM Provider Status

### Webhook Management
- Add Webhook Endpoints
- Configure Events
- View Delivery History
- Retry Failed Deliveries

### API Keys
- Generate API Keys
- View Active Keys
- Revoke Keys
- Set Key Permissions

---

## 12. 📦 Background Jobs (`/admin/jobs`)

### Job Queue
- View Pending Jobs
- View Running Jobs
- View Completed Jobs
- View Failed Jobs

### Job Actions
- Cancel Job
- Retry Failed Job
- View Job Logs
- Kill Stuck Job

### Scheduler
- View Scheduled Tasks
- Pause/Resume Tasks
- Modify Schedule
- Run Task Now

### Worker Status
- Active Workers
- Worker Health
- Jobs per Worker
- Restart Worker

---

## 13. 🎨 Branding & UI (`/admin/branding`)

### Theme Customization
- Primary Color
- Secondary Color
- Logo Upload
- Favicon Upload

### Login Page
- Custom Background
- Welcome Message
- Terms & Conditions Link
- Support Contact

### Dashboard Layout
- Widget Visibility
- Default Dashboard View
- Quick Action Buttons

---

## 14. 🛠️ Maintenance (`/admin/maintenance`)

### Data Management
- Export All Data
- Import Data
- Data Backup (manual trigger)
- Backup Schedule

### Database Tools
- View Table Statistics
- Run Vacuum (cleanup)
- Index Status
- Query Performance

### System Maintenance
- Clear Cache
- Clear Temp Files
- Restart Services
- Health Check

### Migration Tools
- View Migration Status
- Run Pending Migrations
- Rollback Option

---

## Database Tables Needed

### Additional Tables for Admin Features

```sql
-- System Settings (key-value store)
system_settings (already exists, enhance)

-- Feature Flags
feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN,
  description TEXT,
  updated_at TIMESTAMP
)

-- Email Templates
email_templates (
  id UUID,
  name TEXT,
  subject TEXT,
  body TEXT,
  variables JSONB,
  updated_at TIMESTAMP
)

-- Alert Rules
alert_rules (
  id UUID,
  name TEXT,
  condition JSONB,
  action TEXT,
  recipients JSONB,
  enabled BOOLEAN
)

-- API Keys (for external integrations)
api_keys (
  id UUID,
  name TEXT,
  key_hash TEXT,
  permissions JSONB,
  expires_at TIMESTAMP,
  created_by UUID
)

-- Scheduled Tasks Config
scheduled_tasks (
  id UUID,
  name TEXT,
  task_type TEXT,
  schedule TEXT (cron),
  config JSONB,
  enabled BOOLEAN,
  last_run TIMESTAMP,
  next_run TIMESTAMP
)

-- Branding Settings
branding_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  file_path TEXT,
  updated_at TIMESTAMP
)
```

---

## Implementation Priority

### Phase 1 (Core Admin) - IMMEDIATE
1. Admin Dashboard Home with metrics
2. User Management (full CRUD)
3. Discovery Configuration
4. Connector Management
5. Basic System Settings

### Phase 2 (Configuration)
6. AI Configuration
7. Workflow Configuration
8. Security Settings
9. Notification Settings

### Phase 3 (Advanced)
10. Audit & Compliance
11. Background Jobs
12. Integrations

### Phase 4 (Polish)
13. Branding
14. Maintenance Tools
15. Advanced Analytics

---

## API Endpoints Needed

### New Admin Endpoints
```
/api/admin/metrics              # Dashboard metrics
/api/admin/settings             # System settings CRUD
/api/admin/settings/{key}       # Individual setting
/api/admin/feature-flags        # Feature flags CRUD
/api/admin/email-templates      # Email templates CRUD
/api/admin/alert-rules          # Alert rules CRUD
/api/admin/api-keys             # API keys management
/api/admin/scheduled-tasks      # Scheduler management
/api/admin/branding             # Branding settings
/api/admin/cache/clear          # Clear cache
/api/admin/discovery/trigger    # Manual discovery
/api/admin/discovery/config     # Discovery settings
/api/admin/ai/test              # Test AI connection
/api/admin/ai/config            # AI settings
```

---

## Security Considerations

1. **Admin Route Protection** - Separate admin routes with strict role checking
2. **Action Logging** - All admin actions logged to audit
3. **Sensitive Data Masking** - API keys shown as ****
4. **Confirmation Dialogs** - Destructive actions require confirmation
5. **Rate Limiting** - Admin endpoints have stricter limits
6. **Session Management** - Admin sessions can be invalidated

---

*Document Version: 1.0*
*Last Updated: 2026-01-28*

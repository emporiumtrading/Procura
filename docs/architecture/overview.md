# Procura Ops Command - Technical Architecture

## System Overview

Procura is a Government Contract Opportunity Automation Platform that automates the discovery, qualification, and submission of government contract opportunities.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│              React + TypeScript + Vite + Tailwind                │
│   Dashboard | Submissions | Credentials | Audit | Workspace      │
└─────────────────────────────────────┬───────────────────────────┘
                                      │ HTTPS + JWT
┌─────────────────────────────────────▼───────────────────────────┐
│                         BACKEND                                   │
│                  Python 3.11 + FastAPI                           │
│   Routers: opportunities | submissions | connectors | audit      │
└───────┬─────────────────────┬─────────────────────┬─────────────┘
        │                     │                     │
┌───────▼───────┐     ┌───────▼───────┐     ┌───────▼───────┐
│   Supabase    │     │ Celery+Redis  │     │   OpenManus   │
│  PostgreSQL   │     │  Task Queue   │     │   Browser     │
│   + Auth      │     │  + Scheduler  │     │  Automation   │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

## Technology Stack

### Backend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | FastAPI | 0.110.0 | Async REST API |
| Runtime | Python | 3.11+ | Backend logic |
| Task Queue | Celery | 5.3.6 | Scheduled jobs |
| Broker | Redis | 5.0.1 | Message queue |
| Database | Supabase PostgreSQL | Latest | Data storage |
| Auth | Supabase Auth | Latest | JWT authentication |

### Frontend

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| Framework | React | 19.x | UI components |
| Build | Vite | 6.x | Development server |
| Language | TypeScript | 5.x | Type safety |
| Routing | React Router | 7.x | Navigation |
| Auth | @supabase/supabase-js | 2.43+ | Auth client |

### AI/ML

| Component | Technology | Purpose |
|-----------|------------|---------|
| Primary LLM | Anthropic Claude 3.5 Sonnet | Contract analysis |
| Fallback LLM | OpenAI GPT-4 | Backup provider |
| Caching | PostgreSQL | Response caching |

### Security

| Component | Technology | Purpose |
|-----------|------------|---------|
| Encryption | Fernet (cryptography) | Credential vault |
| Signing | HMAC-SHA256 | Audit integrity |
| Auth | Supabase JWT | API authentication |
| RLS | PostgreSQL | Row-level security |

---

## Data Flow

### 1. Discovery Flow
```
Celery Beat → Connector → API → Normalize → Upsert → DB
```

### 2. Qualification Flow
```
Opportunity → LLM Prompt → Claude API → Score → Cache → DB
```

### 3. Submission Flow
```
Workspace → Approval → OpenManus → Portal → Receipt → Audit Log
```

---

## Core Components

### Backend Structure

```
backend/
├── main.py              # FastAPI app entry point
├── config.py            # Environment configuration
├── database.py          # Supabase client
├── dependencies.py      # Auth middleware
├── models.py            # Pydantic schemas
├── routers/             # API endpoints
│   ├── opportunities.py
│   ├── submissions.py
│   ├── connectors.py
│   ├── audit.py
│   └── admin.py
├── scrapers/            # Data source connectors
│   ├── base.py
│   ├── govcon_api.py
│   ├── sam_gov.py
│   └── usaspending.py
├── ai/                  # LLM integration
│   ├── llm_client.py
│   └── qualification.py
├── automation/          # OpenManus integration
│   ├── openmanus_client.py
│   └── submission_engine.py
├── security/            # Encryption & signing
│   ├── vault.py
│   └── audit.py
└── tasks/               # Celery tasks
    ├── celery_app.py
    └── discovery.py
```

### Frontend Structure

```
src/
├── components/          # Reusable UI components
├── pages/              # Route pages
├── lib/                # Utilities
│   └── api.ts          # API client
└── context/            # React contexts
    └── AuthContext.tsx
```

---

## Database Schema Overview

### Core Tables

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User accounts | id, email, role, department |
| `opportunities` | Discovered contracts | external_ref, agency, due_date, fit_score |
| `submissions` | Proposal workspaces | opportunity_id, status, approval_status |
| `submission_files` | Uploaded documents | file_name, storage_path, scan_status |
| `submission_tasks` | Checklist items | title, completed, locked |
| `connectors` | Portal configurations | name, auth_type, encrypted_credentials |
| `discovery_runs` | Scraper execution logs | connector_id, status, records_fetched |
| `submission_runs` | Automation execution | submission_id, receipt_id, screenshots |
| `audit_logs` | Immutable trail | submission_ref, confirmation_hash |
| `approval_workflows` | Approval chain | step_name, approver_id, status |
| `llm_cache` | AI response cache | prompt_hash, response, tokens_used |
| `system_settings` | Configuration | key, value (autonomy_mode, llm_provider) |

### Status Enums

```sql
opportunity_status: 'new' | 'reviewing' | 'qualified' | 'disqualified' | 'submitted'
submission_status: 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'rejected'
approval_status: 'pending' | 'legal_approved' | 'finance_approved' | 'complete' | 'rejected'
connector_status: 'active' | 'warning' | 'revoked'
run_status: 'pending' | 'running' | 'success' | 'failed'
user_role: 'admin' | 'contract_officer' | 'viewer'
```

---

## External Integrations

### Discovery Sources

| Source | Type | API Key Required |
|--------|------|------------------|
| GovCon API | Aggregated Federal | Yes - `GOVCON_API_KEY` |
| SAM.gov | Federal Direct | Yes - `SAM_GOV_API_KEY` |
| USAspending | Contract Awards | No (public) |
| Grants.gov | Grants | Yes |
| NewsAPI | Market Intelligence | Yes - `NEWS_API_KEY` |

### Browser Automation

- **OpenManus**: AI Agent Platform for browser automation
- **Fallback**: Playwright/Puppeteer as backup option

---

## Security Architecture

### Authentication & Authorization
- JWT-based authentication via Supabase
- Role-based access control (admin, officer, viewer)
- Row-level security in PostgreSQL
- Token refresh handling

### Data Protection
- Fernet encryption for credentials (AES-128)
- HMAC-SHA256 for audit log integrity
- HTTPS for all API communication
- Sensitive data excluded from logs

### Compliance Considerations
- SOC 2 Type II readiness
- NIST 800-171 alignment
- FedRAMP preparation (if needed)
- Data retention policies (7+ years for audits)

---

## Deployment Architecture

### Development
- Local FastAPI server (uvicorn)
- Local Redis (Docker)
- Supabase cloud project
- Vite dev server

### Production
- Railway/Render with autoscaling
- Upstash Redis with persistence
- Supabase production project
- Vercel production with CDN
- Custom domain with SSL
- Monitoring (Sentry, Datadog)

---

## Scalability

### Horizontal Scaling
- **API Servers**: Multiple FastAPI instances behind load balancer
- **Celery Workers**: Add workers for parallel task processing
- **Redis**: Cluster mode for high availability
- **Database**: Supabase handles scaling automatically

### Performance Targets
- 99.5% API uptime
- < 200ms average response time
- < 0.1% error rate
- 500+ opportunities/month capacity

---

*For detailed implementation and setup instructions, see the [Getting Started Guide](../getting-started/README.md)*

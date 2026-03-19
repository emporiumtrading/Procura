# Procura Ops Command - Project Plan

## Executive Summary

**Procura** is a Government Contract Opportunity Automation Platform designed to automate the discovery, qualification, and submission of government contract opportunities for businesses targeting federal, state, and local government markets.

---

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Solution Overview](#solution-overview)
3. [Core Features](#core-features)
4. [Technical Architecture](#technical-architecture)
5. [Technology Stack](#technology-stack)
6. [Database Schema](#database-schema)
7. [API Endpoints](#api-endpoints)
8. [External Integrations](#external-integrations)
9. [Security Requirements](#security-requirements)
10. [Phased Implementation Checklist](#phased-implementation-checklist)
11. [Environment Configuration](#environment-configuration)
12. [Deployment Strategy](#deployment-strategy)
13. [Success Metrics](#success-metrics)

---

## Problem Statement

Government contractors face significant challenges:

| Challenge                      | Impact                                                                 |
| ------------------------------ | ---------------------------------------------------------------------- |
| **Manual Discovery**           | Hours spent searching SAM.gov, Grants.gov, state portals daily         |
| **Inconsistent Qualification** | No standardized scoring leads to missed opportunities or wasted effort |
| **Fragmented Documents**       | Proposals scattered across folders, emails, shared drives              |
| **Credential Chaos**           | Portal passwords in sticky notes, shared accounts, security risks      |
| **Submission Inefficiency**    | Manual form filling, repeated data entry, human errors                 |
| **Limited Visibility**         | No audit trail, unclear submission status, compliance gaps             |

---

## Solution Overview

Procura automates the entire contract lifecycle:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PROCURA PLATFORM                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐           │
│  │  DISCOVERY   │ -> │ QUALIFICATION│ -> │  SUBMISSION  │           │
│  │              │    │              │    │              │           │
│  │ - SAM.gov    │    │ - AI Scoring │    │ - OpenManus  │           │
│  │ - GovCon API │    │ - Fit/Effort │    │ - Auto-fill  │           │
│  │ - USAspending│    │ - Urgency    │    │ - Receipts   │           │
│  └──────────────┘    └──────────────┘    └──────────────┘           │
│         │                   │                   │                    │
│         ▼                   ▼                   ▼                    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │                    SECURE DATA LAYER                          │    │
│  │  Supabase PostgreSQL + RLS + Encrypted Vault + Audit Logs    │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Features

### 1. Opportunity Discovery

- **Automated Scraping**: Scheduled fetches from multiple government sources
- **Real-time Updates**: 15-minute refresh intervals
- **Deduplication**: Intelligent matching to avoid duplicates
- **Normalized Data**: Consistent format across all sources

### 2. AI Qualification Engine

- **Fit Score (0-100)**: How well opportunity matches capabilities
- **Effort Score (0-100)**: Complexity and resource requirements
- **Urgency Score (0-100)**: Time-sensitivity based on deadline
- **AI Summary**: Natural language explanation of opportunity value
- **LLM Provider**: Claude 3.5 Sonnet (primary), GPT-4 (fallback)

### 3. Submission Workflow

- **Workspace**: Centralized preparation environment
- **Checklist**: Track required tasks and documents
- **Approval Chain**: Legal → Finance → Executive sign-off
- **Autonomy Mode**: Auto-approve under threshold (configurable $)

### 4. Browser Automation (OpenManus)

- **Form Filling**: Automated data entry on government portals
- **File Upload**: Attach proposal documents
- **Screenshot Capture**: Evidence of submission
- **Receipt Extraction**: Confirmation numbers and timestamps

### 5. Credential Vault

- **Fernet Encryption**: AES-128-CBC for credentials at rest
- **Rotation Support**: Scheduled credential refresh
- **Access Control**: Admin-only visibility
- **Audit Trail**: All access logged

### 6. Audit & Compliance

- **Immutable Logs**: Cryptographically signed (HMAC-SHA256)
- **Evidence Storage**: Screenshots, PDFs, receipts
- **Export Capability**: JSON export for compliance audits
- **Integrity Verification**: Tamper detection

---

## Technical Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                  │
│              React + TypeScript + Vite + Tailwind                │
│   Dashboard | Submissions | Credentials | Audit | Workspace      │
└─────────────────────────────────────────┬───────────────────────┘
                                          │ HTTPS + JWT
┌─────────────────────────────────────────▼───────────────────────┐
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

### Data Flow

1. **Discovery Flow**: Celery Beat → Connector → API → Normalize → Upsert → DB
2. **Qualification Flow**: Opportunity → LLM Prompt → Claude API → Score → Cache → DB
3. **Submission Flow**: Workspace → Approval → OpenManus → Portal → Receipt → Audit Log

---

## Technology Stack

### Backend

| Component  | Technology          | Version | Purpose            |
| ---------- | ------------------- | ------- | ------------------ |
| Framework  | FastAPI             | 0.110.0 | Async REST API     |
| Runtime    | Python              | 3.11+   | Backend logic      |
| Task Queue | Celery              | 5.3.6   | Scheduled jobs     |
| Broker     | Redis               | 5.0.1   | Message queue      |
| Database   | Supabase PostgreSQL | Latest  | Data storage       |
| Auth       | Supabase Auth       | Latest  | JWT authentication |

### Frontend

| Component | Technology            | Version | Purpose            |
| --------- | --------------------- | ------- | ------------------ |
| Framework | React                 | 19.x    | UI components      |
| Build     | Vite                  | 6.x     | Development server |
| Language  | TypeScript            | 5.x     | Type safety        |
| Routing   | React Router          | 7.x     | Navigation         |
| Auth      | @supabase/supabase-js | 2.43+   | Auth client        |

### AI/ML

| Component    | Technology                  | Purpose           |
| ------------ | --------------------------- | ----------------- |
| Primary LLM  | Anthropic Claude 3.5 Sonnet | Contract analysis |
| Fallback LLM | OpenAI GPT-4                | Backup provider   |
| Caching      | PostgreSQL                  | Response caching  |

### Security

| Component  | Technology            | Purpose            |
| ---------- | --------------------- | ------------------ |
| Encryption | Fernet (cryptography) | Credential vault   |
| Signing    | HMAC-SHA256           | Audit integrity    |
| Auth       | Supabase JWT          | API authentication |
| RLS        | PostgreSQL            | Row-level security |

---

## Database Schema

### Tables Overview

| Table                | Purpose                | Key Fields                                |
| -------------------- | ---------------------- | ----------------------------------------- |
| `profiles`           | User accounts          | id, email, role, department               |
| `opportunities`      | Discovered contracts   | external_ref, agency, due_date, fit_score |
| `submissions`        | Proposal workspaces    | opportunity_id, status, approval_status   |
| `submission_files`   | Uploaded documents     | file_name, storage_path, scan_status      |
| `submission_tasks`   | Checklist items        | title, completed, locked                  |
| `connectors`         | Portal configurations  | name, auth_type, encrypted_credentials    |
| `discovery_runs`     | Scraper execution logs | connector_id, status, records_fetched     |
| `submission_runs`    | Automation execution   | submission_id, receipt_id, screenshots    |
| `audit_logs`         | Immutable trail        | submission_ref, confirmation_hash         |
| `approval_workflows` | Approval chain         | step_name, approver_id, status            |
| `llm_cache`          | AI response cache      | prompt_hash, response, tokens_used        |
| `system_settings`    | Configuration          | key, value (autonomy_mode, llm_provider)  |

### Enums

```sql
opportunity_status: 'new' | 'reviewing' | 'qualified' | 'disqualified' | 'submitted'
submission_status: 'draft' | 'pending_approval' | 'approved' | 'submitted' | 'rejected'
approval_status: 'pending' | 'legal_approved' | 'finance_approved' | 'complete' | 'rejected'
connector_status: 'active' | 'warning' | 'revoked'
run_status: 'pending' | 'running' | 'success' | 'failed'
user_role: 'admin' | 'contract_officer' | 'viewer'
```

---

## API Endpoints

### Opportunities (`/api/opportunities`)

| Method | Endpoint           | Description       | Auth    |
| ------ | ------------------ | ----------------- | ------- |
| GET    | `/`                | List with filters | User    |
| GET    | `/{id}`            | Get single        | User    |
| POST   | `/`                | Create manual     | Officer |
| PATCH  | `/{id}`            | Update            | Officer |
| PATCH  | `/{id}/disqualify` | Disqualify        | Officer |
| POST   | `/sync`            | Trigger discovery | Officer |
| POST   | `/{id}/qualify`    | AI qualification  | Officer |

### Submissions (`/api/submissions`)

| Method | Endpoint                | Description          | Auth    |
| ------ | ----------------------- | -------------------- | ------- |
| GET    | `/`                     | List user's          | User    |
| GET    | `/{id}`                 | Get with files/tasks | Owner   |
| POST   | `/`                     | Create workspace     | User    |
| PATCH  | `/{id}`                 | Update               | Owner   |
| POST   | `/{id}/approve`         | Approve step         | Officer |
| POST   | `/{id}/reject`          | Reject               | Officer |
| POST   | `/{id}/finalize`        | Execute automation   | Officer |
| PATCH  | `/{id}/tasks/{task_id}` | Update task          | Owner   |

### Connectors (`/api/connectors`)

| Method | Endpoint       | Description        | Auth  |
| ------ | -------------- | ------------------ | ----- |
| GET    | `/`            | List all           | Admin |
| GET    | `/{id}`        | Get single         | Admin |
| POST   | `/`            | Create             | Admin |
| PATCH  | `/{id}`        | Update             | Admin |
| POST   | `/{id}/rotate` | Rotate credentials | Admin |
| DELETE | `/{id}`        | Revoke             | Admin |
| POST   | `/{id}/test`   | Test connection    | Admin |
| GET    | `/{id}/runs`   | Get run history    | Admin |

### Audit (`/api/audit-logs`)

| Method | Endpoint       | Description      | Auth  |
| ------ | -------------- | ---------------- | ----- |
| GET    | `/`            | List logs        | User  |
| GET    | `/{id}/verify` | Verify integrity | Admin |
| GET    | `/export/json` | Export all       | Admin |

### Admin (`/api/admin`)

| Method | Endpoint           | Description        | Auth  |
| ------ | ------------------ | ------------------ | ----- |
| GET    | `/users`           | List users         | Admin |
| PATCH  | `/users/{id}/role` | Update role        | Admin |
| DELETE | `/users/{id}`      | Delete user        | Admin |
| GET    | `/autonomy`        | Get settings       | Admin |
| PATCH  | `/autonomy`        | Update settings    | Admin |
| GET    | `/health`          | System health      | Admin |
| GET    | `/runs`            | All discovery runs | Admin |
| POST   | `/runs/{id}/retry` | Retry failed run   | Admin |

---

## External Integrations

### API Sources

| Source      | Type                | Status         | API Key Required        |
| ----------- | ------------------- | -------------- | ----------------------- |
| GovCon API  | Aggregated Federal  | ✅ Implemented | Yes - `GOVCON_API_KEY`  |
| SAM.gov     | Federal Direct      | ✅ Implemented | Yes - `SAM_GOV_API_KEY` |
| USAspending | Contract Awards     | ✅ Implemented | No (public)             |
| Grants.gov  | Grants              | 🔜 Planned     | Yes                     |
| NewsAPI     | Market Intelligence | 🔜 Planned     | Yes - `NEWS_API_KEY`    |

### Browser Automation

| Component | Technology           | Status                 |
| --------- | -------------------- | ---------------------- |
| OpenManus | AI Agent Platform    | 🔜 Integration Pending |
| Fallback  | Playwright/Puppeteer | Backup option          |

---

## Security Requirements

### Authentication & Authorization

- [x] JWT-based authentication via Supabase
- [x] Role-based access control (admin, officer, viewer)
- [x] Row-level security in PostgreSQL
- [x] Token refresh handling

### Data Protection

- [x] Fernet encryption for credentials (AES-128)
- [x] HMAC-SHA256 for audit log integrity
- [x] HTTPS for all API communication
- [x] Sensitive data excluded from logs

### Compliance Considerations

- [ ] SOC 2 Type II readiness
- [ ] NIST 800-171 alignment
- [ ] FedRAMP preparation (if needed)
- [ ] Data retention policies (7+ years for audits)

---

## Phased Implementation Checklist

### Phase 1: Core Infrastructure ✅ COMPLETE

- [x] Database schema design
- [x] Supabase project setup
- [x] SQL migrations created
- [x] RLS policies defined
- [x] FastAPI project structure
- [x] Configuration management
- [x] Pydantic models
- [x] Auth middleware
- [x] Basic API routers

### Phase 2: Discovery & Vault ✅ COMPLETE

- [x] Connector framework (base class)
- [x] GovCon API connector
- [x] SAM.gov API connector
- [x] USAspending connector
- [x] Credential vault (Fernet)
- [x] Celery task configuration
- [x] Discovery task implementation
- [x] Install Python dependencies ✅
- [x] Configure environment variables ✅
- [x] Generate security keys ✅
- [x] Backend server running on port 8001 ✅
- [x] Test connector endpoints ✅ (USAspending, NewsAPI working)
- [x] Celery worker running ✅
- [ ] Verify scheduled tasks

### Phase 3: AI Qualification ✅ IN PROGRESS

- [x] LLM client (multi-provider)
- [x] Qualification engine
- [x] Scoring prompt engineering
- [x] Response caching
- [x] **Google Gemini configured** ✅
- [ ] **Connect Anthropic API**
- [ ] **Test qualification flow** (rate limited)
- [ ] **Tune scoring accuracy**

### Phase 4: Submission Automation

- [x] OpenManus client
- [x] Submission engine
- [x] Audit log signing
- [ ] **Deploy OpenManus instance**
- [ ] **Configure portal mappings**
- [ ] **Test form filling**
- [ ] **Capture receipt workflow**

### Phase 5: Frontend Integration ✅ COMPLETE

- [x] API client (TypeScript)
- [x] API client created ✅
- [x] Dashboard fetches from API ✅
- [x] Admin Dashboard created ✅
- [x] Sidebar updated ✅
- [x] Auth context with MFA ✅
- [x] Landing Page created ✅
- [x] Protected Routes implemented ✅
- [x] Connected all pages to basic layout ✅
- [x] Testing Guide created ✅

### Phase 6: Testing & Hardening 🟡 READY TO START

- [x] Unit tests (pytest) - _Started_
- [x] Integration guides created (TESTING_GUIDE.md)
- [ ] Load testing
- [ ] Security audit
- [ ] Error handling review
- [ ] Logging improvements
- [ ] Logging improvements

### Phase 7: Deployment

- [ ] Backend deployment (Railway/Render)
- [ ] Redis deployment (Upstash)
- [ ] Frontend deployment (Vercel)
- [ ] Domain configuration
- [ ] SSL certificates
- [ ] Monitoring setup (Sentry)

---

## Environment Configuration

### Backend `.env` (Required Variables)

```bash
# ===== SUPABASE (REQUIRED) =====
SUPABASE_URL=https://zspsrdicgjihdoilciyk.supabase.co  # ✅ Configured
SUPABASE_SERVICE_ROLE_KEY=your-key         # ⚠️ Get from Supabase Dashboard > Settings > API
SUPABASE_ANON_KEY=your-anon-key            # ✅ Configured

# ===== REDIS (REQUIRED for Celery) =====
REDIS_URL=redis://localhost:6379/0         # 🔜 Configure (docker run -d -p 6379:6379 redis:alpine)

# ===== DISCOVERY APIs =====
GOVCON_API_KEY=gca_RnrPy...                # ✅ Configured
SAM_GOV_API_KEY=placeholder                # ⚠️ Register at sam.gov/content/entity-information
USASPENDING_API_BASE=https://api.usaspending.gov/api/v2  # ✅ Public API
NEWS_API_KEY=3591ab...                     # ✅ Configured
NEWS_API_BASE=https://newsapi.org/v2       # ✅ Set

# ===== LLM PROVIDERS =====
PROCURA_LLM_PROVIDER=anthropic             # Default provider
ANTHROPIC_API_KEY=placeholder              # ⚠️ Get from console.anthropic.com
OPENAI_API_KEY=placeholder                 # ⚠️ Get from platform.openai.com (optional)

# ===== SECURITY KEYS (REQUIRED) =====
VAULT_ENCRYPTION_KEY=EqcP1QKVm95K...       # ✅ Generated
AUDIT_SIGNING_KEY=ef36c87fd479cbd5...      # ✅ Generated

# ===== OPENMANUS =====
OPENMANUS_API_URL=http://localhost:8080    # Local instance
OPENMANUS_API_KEY=placeholder              # ⚠️ If using hosted

# ===== APPLICATION =====
ENVIRONMENT=development
DEBUG=true
PROCURA_ALLOWED_ORIGINS=http://localhost:5173
```

### Generate Security Keys

```bash
# Vault encryption key (run in Python)
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Audit signing key
python -c "import secrets; print(secrets.token_hex(32))"
```

### Frontend `.env.local`

```bash
VITE_SUPABASE_URL=https://zspsrdicgjihdoilciyk.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_API_URL=http://localhost:8001/api  # Backend runs on 8001
```

---

## Deployment Strategy

### Development

- Local FastAPI server (uvicorn)
- Local Redis (Docker)
- Supabase cloud project
- Vite dev server

### Staging

- Railway/Render for backend
- Upstash for Redis
- Supabase staging project
- Vercel preview deployments

### Production

- Railway/Render with autoscaling
- Upstash Redis with persistence
- Supabase production project
- Vercel production with CDN
- Custom domain with SSL
- Monitoring (Sentry, Datadog)

---

## Success Metrics

### Phase 1-2 (Foundation)

- [x] Backend starts without errors ✅
- [x] All API endpoints return 200/401/403 appropriately ✅
- [ ] Database queries execute under 100ms
- [ ] Celery workers process tasks

### Phase 3 (Discovery)

- [ ] 50+ opportunities fetched per sync
- [ ] Deduplication rate > 95%
- [ ] Sync completes in < 60 seconds

### Phase 4 (Qualification)

- [ ] AI scoring runs in < 5 seconds
- [ ] 85%+ user agreement with scores
- [ ] Cache hit rate > 70%

### Phase 5 (Automation)

- [ ] 90%+ form fill success rate
- [ ] Receipt capture 100% reliable
- [ ] Average submission time < 5 minutes

### Production

- [ ] 99.5% API uptime
- [ ] < 200ms average response time
- [ ] < 0.1% error rate
- [ ] 500+ opportunities/month capacity

---

## Next Steps (Immediate)

1. ~~Install Python dependencies~~ ✅ Done
2. ~~Generate and configure security keys~~ ✅ Done
3. ~~Start backend server~~ ✅ Running on port 8001
4. **Get SAM.gov API key** - Register at sam.gov/content/entity-information
5. **Get Anthropic API key** - Register at console.anthropic.com
6. **Get Supabase service_role key** - Dashboard > Settings > API
7. **Connect frontend to backend** - Begin integration
8. **Set up Redis** - For Celery scheduled tasks

---

_Document Version: 1.0_  
_Last Updated: 2026-01-28_  
_Status: Phase 2 - Discovery & Vault_

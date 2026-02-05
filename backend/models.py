"""
Procura Pydantic Models
Request/Response schemas for API endpoints
"""
from datetime import datetime, date
from typing import Optional, List, Any
from enum import Enum
from pydantic import BaseModel, Field, EmailStr


# ===========================================
# ENUMS
# ===========================================

class OpportunityStatus(str, Enum):
    NEW = "new"
    REVIEWING = "reviewing"
    QUALIFIED = "qualified"
    DISQUALIFIED = "disqualified"
    SUBMITTED = "submitted"


class SubmissionStatus(str, Enum):
    DRAFT = "draft"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    SUBMITTED = "submitted"
    REJECTED = "rejected"


class ApprovalStatus(str, Enum):
    PENDING = "pending"
    LEGAL_APPROVED = "legal_approved"
    FINANCE_APPROVED = "finance_approved"
    COMPLETE = "complete"
    REJECTED = "rejected"


class ConnectorStatus(str, Enum):
    ACTIVE = "active"
    WARNING = "warning"
    REVOKED = "revoked"


class RunStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILED = "failed"


class UserRole(str, Enum):
    ADMIN = "admin"
    CONTRACT_OFFICER = "contract_officer"
    VIEWER = "viewer"


# ===========================================
# BASE MODELS
# ===========================================

class BaseResponse(BaseModel):
    success: bool = True
    message: Optional[str] = None


# ===========================================
# PROFILE MODELS
# ===========================================

class ProfileBase(BaseModel):
    email: EmailStr
    full_name: Optional[str] = None
    role: UserRole = UserRole.VIEWER
    department: Optional[str] = None


class ProfileResponse(ProfileBase):
    id: str
    created_at: datetime
    last_active: Optional[datetime] = None


# ===========================================
# OPPORTUNITY MODELS
# ===========================================

class OpportunityBase(BaseModel):
    title: str
    agency: str
    description: Optional[str] = None
    naics_code: Optional[str] = None
    set_aside: Optional[str] = None
    posted_date: date
    due_date: date
    estimated_value: Optional[float] = None


class OpportunityCreate(OpportunityBase):
    external_ref: str
    source: str
    raw_data: Optional[dict] = None


class OpportunityUpdate(BaseModel):
    status: Optional[OpportunityStatus] = None
    disqualified_reason: Optional[str] = None
    fit_score: Optional[int] = Field(None, ge=0, le=100)
    effort_score: Optional[int] = Field(None, ge=0, le=100)
    urgency_score: Optional[int] = Field(None, ge=0, le=100)
    ai_summary: Optional[str] = None


class OpportunityResponse(OpportunityBase):
    id: str
    external_ref: str
    source: str
    status: OpportunityStatus
    fit_score: Optional[int] = None
    effort_score: Optional[int] = None
    urgency_score: Optional[int] = None
    ai_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class OpportunityListResponse(BaseResponse):
    data: List[OpportunityResponse]
    total: int
    page: int
    limit: int


# ===========================================
# SUBMISSION MODELS
# ===========================================

class SubmissionCreate(BaseModel):
    opportunity_id: str
    portal: str
    title: Optional[str] = None
    due_date: date
    notes: Optional[str] = None


class SubmissionUpdate(BaseModel):
    status: Optional[SubmissionStatus] = None
    approval_status: Optional[ApprovalStatus] = None
    notes: Optional[str] = None


class SubmissionFileResponse(BaseModel):
    id: str
    file_name: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    storage_path: str
    scan_status: str
    created_at: datetime


class SubmissionTaskResponse(BaseModel):
    id: str
    title: str
    subtitle: Optional[str] = None
    completed: bool
    locked: bool
    completed_at: Optional[datetime] = None


class SubmissionResponse(BaseModel):
    id: str
    opportunity_id: str
    owner_id: str
    title: str
    portal: str
    status: SubmissionStatus
    approval_status: ApprovalStatus
    due_date: date
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    # Nested
    opportunity: Optional[OpportunityResponse] = None
    owner: Optional[ProfileResponse] = None
    files: Optional[List[SubmissionFileResponse]] = None
    tasks: Optional[List[SubmissionTaskResponse]] = None


class SubmissionListResponse(BaseResponse):
    data: List[SubmissionResponse]
    total: int


# ===========================================
# CONNECTOR MODELS
# ===========================================

class ConnectorCreate(BaseModel):
    name: str
    label: Optional[str] = None
    portal_url: Optional[str] = None
    auth_type: str  # oauth2, api_key, basic
    credentials: dict  # Will be encrypted before storage
    schedule_cron: Optional[str] = None
    rate_limit_per_min: int = 60


class ConnectorUpdate(BaseModel):
    label: Optional[str] = None
    portal_url: Optional[str] = None
    status: Optional[ConnectorStatus] = None
    schedule_cron: Optional[str] = None
    rate_limit_per_min: Optional[int] = None


class ConnectorResponse(BaseModel):
    id: str
    name: str
    label: Optional[str] = None
    portal_url: Optional[str] = None
    auth_type: str
    status: ConnectorStatus
    schedule_cron: Optional[str] = None
    rate_limit_per_min: int
    last_run_at: Optional[datetime] = None
    last_success_at: Optional[datetime] = None
    error_count: int
    created_at: datetime


class ConnectorListResponse(BaseResponse):
    data: List[ConnectorResponse]


# ===========================================
# DISCOVERY RUN MODELS
# ===========================================

class DiscoveryRunResponse(BaseModel):
    id: str
    connector_id: Optional[str] = None
    connector_name: str
    run_type: str
    status: RunStatus
    start_time: datetime
    end_time: Optional[datetime] = None
    duration_ms: Optional[int] = None
    records_fetched: int
    opportunities_created: int
    opportunities_updated: int
    errors: int
    error_message: Optional[str] = None


class DiscoveryRunListResponse(BaseResponse):
    data: List[DiscoveryRunResponse]


class SyncTriggerRequest(BaseModel):
    connector_name: Optional[str] = None  # If None, sync all active connectors


class SyncTriggerResponse(BaseResponse):
    run_ids: List[str]


# ===========================================
# AUDIT LOG MODELS
# ===========================================

class AuditLogResponse(BaseModel):
    id: str
    submission_id: Optional[str] = None
    submission_ref: str
    timestamp: datetime
    portal: str
    action: str
    status: str
    receipt_id: Optional[str] = None
    confirmation_hash: str
    evidence_urls: Optional[List[str]] = None


class AuditLogListResponse(BaseResponse):
    data: List[AuditLogResponse]


# ===========================================
# ADMIN MODELS
# ===========================================

class AutonomyModeUpdate(BaseModel):
    enabled: bool
    threshold_usd: Optional[float] = None


class AutonomyModeResponse(BaseModel):
    enabled: bool
    threshold_usd: float


class ConnectorHealthResponse(BaseModel):
    connector_id: str
    name: str
    status: ConnectorStatus
    latency_ms: Optional[int] = None
    uptime_percent: Optional[float] = None
    last_success: Optional[datetime] = None
    error_rate: Optional[float] = None


class SystemHealthResponse(BaseResponse):
    connectors: List[ConnectorHealthResponse]
    total_opportunities: int
    total_submissions: int
    pending_approvals: int


# ===========================================
# AI QUALIFICATION MODELS
# ===========================================

class QualificationScores(BaseModel):
    fit_score: int = Field(..., ge=0, le=100)
    effort_score: int = Field(..., ge=0, le=100)
    urgency_score: int = Field(..., ge=0, le=100)
    summary: str
    reasoning: Optional[dict] = None


class QualificationRequest(BaseModel):
    opportunity_id: str
    force_refresh: bool = False


class QualificationResponse(BaseResponse):
    opportunity_id: str
    scores: QualificationScores
    cached: bool = False


# ===========================================
# SUBMISSION AUTOMATION MODELS
# ===========================================

class SubmissionExecuteRequest(BaseModel):
    submission_id: str
    dry_run: bool = False  # If True, only validate without submitting


class SubmissionExecuteResponse(BaseResponse):
    run_id: str
    status: RunStatus
    receipt_id: Optional[str] = None
    screenshots: Optional[List[str]] = None
    error: Optional[str] = None

"""
Company Profile Router
Stores and retrieves the organization's profile used to personalize AI scoring
and proposal generation. Data is persisted as a JSON blob in system_settings
under the key 'company_profile'.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
from pydantic import BaseModel
import structlog

from ..dependencies import require_officer, get_request_supabase
from ..database import get_supabase_client

logger = structlog.get_logger()
router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
# Pydantic models
# ─────────────────────────────────────────────────────────────────────────────

class PastPerformanceEntry(BaseModel):
    title: str
    agency: str
    contract_number: Optional[str] = None
    value: Optional[float] = None
    period: Optional[str] = None          # e.g. "2022-2024"
    description: Optional[str] = None
    naics_code: Optional[str] = None


class CompanyProfile(BaseModel):
    # Identity
    company_name: str = ""
    cage_code: Optional[str] = None
    uei_number: Optional[str] = None      # Unique Entity Identifier (SAM.gov)
    duns_number: Optional[str] = None

    # Contracting eligibility
    naics_codes: List[str] = []           # e.g. ["541511","541512","541519"]
    certifications: List[str] = []        # e.g. ["8(a)","HUBZone","SDVOSB"]
    set_aside_types: List[str] = []       # mirror of certifications for quick lookup
    size_standard: Optional[str] = None  # "small" | "large"
    primary_location: Optional[str] = None

    # Capability
    capabilities: str = ""               # Full capability statement (free text)
    keywords: List[str] = []             # e.g. ["cloud","cybersecurity","DevOps"]
    past_performance: List[PastPerformanceEntry] = []

    # Bidding preferences
    min_contract_value: Optional[float] = None
    max_contract_value: Optional[float] = None
    preferred_agencies: List[str] = []   # e.g. ["DoD","HHS","DHS"]
    excluded_set_asides: List[str] = []  # set-aside types to skip


_SETTINGS_KEY = "company_profile"


def _fetch_profile(supabase: Client) -> dict:
    """Load from system_settings; return empty dict if not set."""
    try:
        row = supabase.table("system_settings").select("value").eq("key", _SETTINGS_KEY).execute()
        if row.data:
            return row.data[0]["value"] or {}
    except Exception as e:
        logger.warning("Failed to load company profile", error=str(e))
    return {}


# ─────────────────────────────────────────────────────────────────────────────
# Public helper used by the AI qualification engine
# ─────────────────────────────────────────────────────────────────────────────

def get_company_profile() -> dict:
    """
    Load the company profile using the service-role client (no RLS).
    Called internally by the AI qualification engine.
    Returns an empty dict when no profile is saved yet.
    """
    try:
        client = get_supabase_client()
        return _fetch_profile(client)
    except Exception as e:
        logger.warning("get_company_profile failed", error=str(e))
        return {}


# ─────────────────────────────────────────────────────────────────────────────
# API endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=CompanyProfile)
async def get_profile(
    supabase: Client = Depends(get_request_supabase),
    _user: dict = Depends(require_officer),
):
    """Return the current company profile."""
    data = _fetch_profile(supabase)
    return CompanyProfile(**data)


@router.put("", response_model=CompanyProfile)
async def save_profile(
    profile: CompanyProfile,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer),
):
    """Create or replace the company profile."""
    payload = profile.model_dump()

    try:
        admin_client = get_supabase_client()
        admin_client.table("system_settings").upsert(
            {"key": _SETTINGS_KEY, "value": payload, "updated_by": user["id"]},
            on_conflict="key",
        ).execute()
    except Exception as e:
        logger.error("Failed to save company profile", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to save company profile",
        )

    logger.info("Company profile saved", user_id=user["id"])
    return profile


@router.patch("", response_model=CompanyProfile)
async def update_profile(
    updates: dict,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer),
):
    """Merge partial updates into the existing company profile."""
    existing = _fetch_profile(supabase)
    merged = {**existing, **updates}

    # Validate by re-parsing
    try:
        validated = CompanyProfile(**merged)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))

    payload = validated.model_dump()
    try:
        admin_client = get_supabase_client()
        admin_client.table("system_settings").upsert(
            {"key": _SETTINGS_KEY, "value": payload, "updated_by": user["id"]},
            on_conflict="key",
        ).execute()
    except Exception as e:
        logger.error("Failed to update company profile", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update company profile",
        )

    return validated

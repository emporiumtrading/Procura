"""
Opportunities Router
CRUD operations for government contract opportunities
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
import asyncio
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from supabase import Client
import structlog

from ..dependencies import get_current_user, require_officer, get_request_supabase
from ..config import settings
from ..database import get_supabase_client
from ..api_keys import get_api_key
from ..models import (
    OpportunityResponse,
    OpportunityListResponse,
    OpportunityCreate,
    OpportunityUpdate,
    OpportunityStatus,
    SyncTriggerRequest,
    SyncTriggerResponse,
    BaseResponse
)
from ..scrapers.govcon_api import GovConAPIConnector
from ..scrapers.sam_gov import SAMGovConnector
from ..scrapers.grants_gov import GrantsGovConnector

logger = structlog.get_logger()

router = APIRouter()

# Simple in-process throttling to avoid hammering external APIs when a user
# repeatedly clicks "Sync". This resets on server restart.
_LAST_SYNC_BY_USER: dict[str, datetime] = {}
_SYNC_COOLDOWN_SECONDS = 30

# Minimum fit score to trigger a notification
_NOTIFY_FIT_THRESHOLD = 70


# ─────────────────────────────────────────────────────────────────────────────
# Background helper: qualify new opps and send notifications
# ─────────────────────────────────────────────────────────────────────────────

async def _auto_qualify_and_notify(new_opp_ids: list[str], triggered_by_user_id: str) -> None:
    """
    For each newly-discovered opportunity:
      1. Load company profile and run the cheap pre-filter.
      2. If it passes, call the LLM to score it.
      3. Persist scores back to the opportunities table.
      4. If fit_score >= threshold, create a notification for all admin/officer users.
    Runs as a background task — never blocks the sync response.
    """
    from ..ai.qualification import qualify_opportunity as ai_qualify, is_prefilter_pass
    from ..routers.company_profile import get_company_profile

    if not new_opp_ids:
        return

    admin_supabase = get_supabase_client()
    profile = get_company_profile()

    # Load all new opps in one query
    rows = admin_supabase.table("opportunities").select("*").in_("id", new_opp_ids).execute()
    opps = rows.data or []

    for opp in opps:
        try:
            if not is_prefilter_pass(opp, profile):
                logger.debug("Opportunity skipped by pre-filter", opp_id=opp["id"])
                continue

            analysis = await ai_qualify(opp, force_refresh=False)
            fit = analysis.get("fit_score", 0)
            scores = {
                "fit_score": analysis.get("fit_score"),
                "effort_score": analysis.get("effort_score"),
                "urgency_score": analysis.get("urgency_score"),
                "ai_summary": analysis.get("summary"),
            }
            admin_supabase.table("opportunities").update(scores).eq("id", opp["id"]).execute()

            # Notify all admin + officer users for high-fit opportunities
            if fit >= _NOTIFY_FIT_THRESHOLD:
                _send_opportunity_notifications(admin_supabase, opp, fit)

            # Run pipeline orchestrator (may auto-create submission in supervised/autonomous modes)
            try:
                from ..workflows.pipeline import run_pipeline
                updated_opp = {**opp, "fit_score": fit}
                await run_pipeline(updated_opp, fit, triggered_by_user_id=triggered_by_user_id)
            except Exception as pe:
                logger.warning("Pipeline orchestration failed", opp_id=opp["id"], error=str(pe)[:200])

            logger.info("Auto-qualified opportunity", opp_id=opp["id"], fit=fit)

        except Exception as e:
            logger.warning("Auto-qualification failed for opportunity", opp_id=opp.get("id"), error=str(e)[:200])


def _send_opportunity_notifications(supabase, opp: dict, fit_score: int) -> None:
    """Insert a notification row for every admin/officer user."""
    try:
        users = supabase.table("profiles").select("id").in_("role", ["admin", "contract_officer"]).execute()
        if not users.data:
            return

        due_date = opp.get("due_date", "TBD")
        value = opp.get("estimated_value")
        value_str = f" · ${value:,.0f}" if value else ""
        priority = "urgent" if fit_score >= 90 else ("high" if fit_score >= 80 else "normal")

        notifications = [
            {
                "user_id": u["id"],
                "title": f"High-Fit Opportunity: {opp.get('title', 'New Opportunity')}",
                "body": (
                    f"Fit Score: {fit_score}/100 · {opp.get('agency', 'Unknown Agency')}"
                    f"{value_str} · Due: {due_date}"
                ),
                "type": "opportunity",
                "priority": priority,
                "entity_type": "opportunity",
                "entity_id": opp["id"],
                "action_url": f"/dashboard",
            }
            for u in users.data
        ]
        supabase.table("notifications").insert(notifications).execute()
        logger.info("Notifications sent", opp_id=opp["id"], fit=fit_score, recipients=len(notifications))
    except Exception as e:
        logger.warning("Failed to send notifications", error=str(e)[:200])


@router.get("", response_model=OpportunityListResponse)
async def list_opportunities(
    status_filter: Optional[OpportunityStatus] = Query(None, alias="status"),
    source: Optional[str] = None,
    min_fit_score: Optional[int] = Query(None, ge=0, le=100),
    search: Optional[str] = None,
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(get_current_user)
):
    """
    List opportunities with optional filters
    """
    offset = (page - 1) * limit

    try:
        query = supabase.table("opportunities").select("*", count="exact")

        if status_filter:
            query = query.eq("status", status_filter.value)
        if source:
            query = query.eq("source", source)
        if min_fit_score is not None:
            query = query.gte("fit_score", min_fit_score)
        if search:
            # Sanitize: strip PostgREST filter control chars to prevent filter injection
            safe_search = search.replace(",", "").replace("(", "").replace(")", "").replace(".", "")
            query = query.or_(f"title.ilike.%{safe_search}%,agency.ilike.%{safe_search}%,external_ref.ilike.%{safe_search}%")
        
        query = query.order("due_date", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        
        return OpportunityListResponse(
            success=True,
            data=response.data,
            total=response.count or len(response.data),
            page=page,
            limit=limit
        )
        
    except Exception as e:
        logger.error("Failed to list opportunities", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch opportunities"
        )


@router.get("/{opportunity_id}", response_model=OpportunityResponse)
async def get_opportunity(
    opportunity_id: str,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(get_current_user)
):
    """
    Get a single opportunity by ID
    """
    try:
        response = supabase.table("opportunities").select("*").eq("id", opportunity_id).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found"
            )
        
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get opportunity", opportunity_id=opportunity_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch opportunity"
        )


@router.post("", response_model=OpportunityResponse, status_code=status.HTTP_201_CREATED)
async def create_opportunity(
    opportunity: OpportunityCreate,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer)
):
    """
    Manually create a new opportunity (admin/officer only)
    """
    try:
        # Check for duplicate
        existing = supabase.table("opportunities").select("id").eq("external_ref", opportunity.external_ref).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Opportunity with ref {opportunity.external_ref} already exists"
            )
        
        response = supabase.table("opportunities").insert(opportunity.model_dump()).execute()
        
        logger.info("Opportunity created", ref=opportunity.external_ref, user_id=user["id"])
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create opportunity", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create opportunity"
        )


@router.patch("/{opportunity_id}", response_model=OpportunityResponse)
async def update_opportunity(
    opportunity_id: str,
    updates: OpportunityUpdate,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer)
):
    """
    Update an opportunity (admin/officer only)
    """
    try:
        # Check exists
        existing = supabase.table("opportunities").select("id").eq("id", opportunity_id).execute()
        if not existing.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found"
            )
        
        # Only update non-None fields
        update_data = {k: v for k, v in updates.model_dump().items() if v is not None}
        if updates.status:
            update_data["status"] = updates.status.value
        
        response = supabase.table("opportunities").update(update_data).eq("id", opportunity_id).execute()
        
        logger.info("Opportunity updated", id=opportunity_id, updates=list(update_data.keys()))
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update opportunity", id=opportunity_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update opportunity"
        )


@router.patch("/{opportunity_id}/disqualify", response_model=OpportunityResponse)
async def disqualify_opportunity(
    opportunity_id: str,
    reason: Optional[str] = None,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer)
):
    """
    Mark an opportunity as disqualified
    """
    try:
        response = supabase.table("opportunities").update({
            "status": "disqualified",
            "disqualified_reason": reason or "Manually disqualified"
        }).eq("id", opportunity_id).execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Opportunity not found"
            )
        
        logger.info("Opportunity disqualified", id=opportunity_id, reason=reason)
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to disqualify opportunity", id=opportunity_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to disqualify opportunity"
        )


@router.post("/sync", response_model=SyncTriggerResponse)
async def trigger_sync(
    background_tasks: BackgroundTasks,
    request: SyncTriggerRequest = SyncTriggerRequest(),
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer),
):
    """
    Trigger a manual discovery sync from all or specific connectors.
    After upserting, newly discovered opportunities are auto-qualified by AI
    in the background. High-fit results (>= 70) generate in-app notifications.
    """
    try:
        now = datetime.now(timezone.utc)
        last = _LAST_SYNC_BY_USER.get(user["id"])
        if last and (now - last).total_seconds() < _SYNC_COOLDOWN_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Sync is rate-limited. Try again in {_SYNC_COOLDOWN_SECONDS} seconds.",
            )
        _LAST_SYNC_BY_USER[user["id"]] = now

        connectors: dict[str, tuple[type, str | None]] = {
            "govcon": (GovConAPIConnector, "GOVCON_API_KEY"),
            "sam": (SAMGovConnector, "SAM_GOV_API_KEY"),
            "grants_gov": (GrantsGovConnector, None),
        }

        requested = request.connector_name.lower() if request.connector_name else None
        connector_names: list[str]
        if requested:
            if requested not in connectors:
                raise HTTPException(status_code=400, detail=f"Unknown connector: {request.connector_name}")
            connector_names = [requested]
        else:
            connector_names = [name for name, (_, key_name) in connectors.items() if get_api_key(key_name)]

        if not connector_names:
            raise HTTPException(
                status_code=400,
                detail="No discovery connectors are configured. Add API keys in Settings > API Keys.",
            )

        since = datetime.now(timezone.utc) - timedelta(days=7)
        run_ids: list[str] = []
        errors: list[str] = []
        all_new_ids: list[str] = []

        admin_supabase = get_supabase_client()

        for name in connector_names:
            connector_class, key_name = connectors[name]
            resolved_key = get_api_key(key_name)
            if not resolved_key:
                errors.append(f"{name}: missing api key")
                continue

            # Fetch + normalize opportunities from the external source
            async with connector_class(api_key=resolved_key) as connector:
                result = await connector.run_discovery(since)

            opps = result.get("opportunities") or []
            if opps:
                # Identify which external_refs are truly new (no fit_score yet)
                ext_refs = [o["external_ref"] for o in opps if o.get("external_ref")]
                existing_refs: set[str] = set()
                try:
                    existing_rows = admin_supabase.table("opportunities") \
                        .select("external_ref") \
                        .in_("external_ref", ext_refs) \
                        .not_.is_("fit_score", "null") \
                        .execute()
                    existing_refs = {r["external_ref"] for r in (existing_rows.data or [])}
                except Exception:
                    pass  # pre-filter check failed — still upsert, just skip auto-qual

                # Batch upsert by external_ref. Prefer service-role client to bypass RLS.
                try:
                    admin_supabase.table("opportunities").upsert(opps, on_conflict="external_ref").execute()
                except Exception as upsert_error:
                    logger.warning(
                        "Service-role upsert failed, retrying with request-scoped client",
                        connector=name,
                        error=str(upsert_error),
                    )
                    supabase.table("opportunities").upsert(opps, on_conflict="external_ref").execute()

                # Collect IDs of genuinely new opportunities for background qualification
                new_refs = [r for r in ext_refs if r not in existing_refs]
                if new_refs:
                    try:
                        new_rows = admin_supabase.table("opportunities") \
                            .select("id") \
                            .in_("external_ref", new_refs) \
                            .execute()
                        all_new_ids.extend(r["id"] for r in (new_rows.data or []))
                    except Exception as e:
                        logger.warning("Could not resolve new opportunity IDs", error=str(e)[:200])

            run_ids.append(f"inline:{name}")
            logger.info("Discovery sync completed", connector=name, fetched=len(opps), user_id=user["id"])

        # Fire auto-qualification in the background — does NOT block the response
        if all_new_ids:
            background_tasks.add_task(_auto_qualify_and_notify, all_new_ids, user["id"])
            logger.info("Background auto-qualification scheduled", count=len(all_new_ids))

        new_count = len(all_new_ids)
        base_msg = "Sync completed" if not errors else f"Sync completed with warnings: {', '.join(errors)}"
        message = f"{base_msg}. {new_count} new opportunit{'y' if new_count == 1 else 'ies'} queued for AI scoring." if new_count else base_msg

        return SyncTriggerResponse(
            success=True,
            message=message,
            run_ids=run_ids,
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to trigger sync", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to trigger sync"
        )


@router.post("/{opportunity_id}/qualify", response_model=OpportunityResponse)
async def qualify_opportunity(
    opportunity_id: str,
    force_refresh: bool = False,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_officer)
):
    """
    Trigger AI qualification for an opportunity
    """
    try:
        # Get opportunity
        opp_response = supabase.table("opportunities").select("*").eq("id", opportunity_id).single().execute()
        if not opp_response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Opportunity not found")
        
        opportunity = opp_response.data
        
        # Check cache unless force refresh
        if not force_refresh and opportunity.get("fit_score") is not None:
            return opportunity
        
        from ..ai.qualification import qualify_opportunity as ai_qualify

        analysis = await ai_qualify(opportunity, force_refresh=force_refresh)
        scores = {
            "fit_score": analysis.get("fit_score"),
            "effort_score": analysis.get("effort_score"),
            "urgency_score": analysis.get("urgency_score"),
            "ai_summary": analysis.get("summary"),
        }
        
        # Update opportunity with scores
        response = supabase.table("opportunities").update(scores).eq("id", opportunity_id).execute()
        
        logger.info("Opportunity qualified", id=opportunity_id, scores=scores)
        return response.data[0]
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to qualify opportunity", id=opportunity_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to qualify opportunity"
        )

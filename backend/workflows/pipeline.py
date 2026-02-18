"""
Pipeline Orchestrator
Manages the autonomy pipeline for government contract opportunity pursuit.

Three modes (stored in system_settings.autonomy_mode):
  manual      – Discovery + scoring + notifications only. Human decides everything.
  supervised  – Auto-create submission DRAFT for fit ≥ fit_threshold (default 80).
                Human reviews before anything is submitted.
  autonomous  – Auto-create draft AND trigger AI proposal generation for
                fit ≥ auto_threshold (default 90) AND value ≤ max_auto_value.

Called from:
  - backend/routers/opportunities.py  (after manual sync auto-qualification)
  - backend/tasks/discovery.py        (after scheduled discovery auto-qualification)
"""
import asyncio
from datetime import datetime, timezone
from typing import Optional
import structlog

logger = structlog.get_logger()

# ── Defaults ──────────────────────────────────────────────────────────────────

DEFAULT_MODE = "manual"
DEFAULT_FIT_THRESHOLD = 80        # supervised: auto-draft above this
DEFAULT_AUTO_THRESHOLD = 90       # autonomous: also auto-generate proposal above this
DEFAULT_MAX_AUTO_VALUE = 500_000  # autonomous: only for contracts ≤ this value (USD)


def _load_pipeline_config() -> dict:
    """
    Load pipeline config from system_settings.
    Falls back to safe defaults if not configured.
    """
    try:
        from ..database import get_supabase_client
        db = get_supabase_client()
        row = db.table("system_settings").select("value").eq("key", "pipeline_config").execute()
        if row.data:
            cfg = row.data[0]["value"]
            if isinstance(cfg, dict):
                return cfg
    except Exception:
        pass
    return {}


def get_pipeline_config() -> dict:
    """Return full pipeline config with defaults filled in."""
    cfg = _load_pipeline_config()
    return {
        "mode": cfg.get("autonomy_mode", DEFAULT_MODE),
        "fit_threshold": int(cfg.get("fit_threshold", DEFAULT_FIT_THRESHOLD)),
        "auto_threshold": int(cfg.get("auto_threshold", DEFAULT_AUTO_THRESHOLD)),
        "max_auto_value": float(cfg.get("max_auto_value", DEFAULT_MAX_AUTO_VALUE)),
    }


def save_pipeline_config(config: dict) -> None:
    """Persist pipeline config to system_settings."""
    from ..database import get_supabase_client
    db = get_supabase_client()
    db.table("system_settings").upsert(
        {"key": "pipeline_config", "value": config},
        on_conflict="key"
    ).execute()


# ── Core orchestration ────────────────────────────────────────────────────────

async def run_pipeline(
    opportunity: dict,
    fit_score: float,
    triggered_by_user_id: Optional[str] = None,
) -> dict:
    """
    Run the pipeline for a single newly-qualified opportunity.
    Returns a dict describing what actions were taken.
    """
    cfg = get_pipeline_config()
    mode = cfg["mode"]
    fit_threshold = cfg["fit_threshold"]
    auto_threshold = cfg["auto_threshold"]
    max_auto_value = cfg["max_auto_value"]

    opp_id = opportunity.get("id")
    opp_value = opportunity.get("estimated_value") or 0
    result = {
        "opportunity_id": opp_id,
        "fit_score": fit_score,
        "mode": mode,
        "actions": [],
    }

    if mode == "manual":
        logger.info("Pipeline: manual mode — no auto-actions", opp_id=opp_id, fit=fit_score)
        return result

    # supervised or autonomous: auto-create submission draft for fit ≥ threshold
    if fit_score < fit_threshold:
        logger.info("Pipeline: fit below threshold — skipping", opp_id=opp_id, fit=fit_score, threshold=fit_threshold)
        return result

    submission_id = await _auto_create_submission(opportunity, triggered_by_user_id)
    if submission_id:
        result["actions"].append({"type": "submission_created", "submission_id": submission_id})
        logger.info("Pipeline: draft submission created", opp_id=opp_id, submission_id=submission_id)

    # autonomous: also auto-generate proposal for very high fit + small contracts
    if (
        mode == "autonomous"
        and fit_score >= auto_threshold
        and float(opp_value) <= max_auto_value
        and submission_id
    ):
        try:
            from ..ai.proposal_generator import generate_full_proposal
            from ..routers.company_profile import get_company_profile

            profile = get_company_profile()

            # Generate and persist sections
            from ..database import get_supabase_client
            sections = await generate_full_proposal(opportunity, profile)
            db = get_supabase_client()
            db.table("submissions").update(
                {"proposal_sections": sections}
            ).eq("id", submission_id).execute()

            result["actions"].append({"type": "proposal_generated", "submission_id": submission_id})
            logger.info("Pipeline: proposal auto-generated", opp_id=opp_id, submission_id=submission_id)
        except Exception as e:
            logger.warning("Pipeline: proposal generation failed", opp_id=opp_id, error=str(e)[:200])

    return result


async def _auto_create_submission(opportunity: dict, user_id: Optional[str]) -> Optional[str]:
    """
    Create a draft submission for the opportunity.
    Returns the submission id, or None on failure.
    """
    from ..database import get_supabase_client

    try:
        db = get_supabase_client()
        opp_id = opportunity.get("id")

        # Check if a submission already exists for this opportunity
        existing = db.table("submissions").select("id").eq("opportunity_id", opp_id).execute()
        if existing.data:
            return existing.data[0]["id"]  # already pursued

        # Find the first admin/officer to assign as owner
        owner_id = user_id
        if not owner_id:
            admins = db.table("profiles").select("id").in_(
                "role", ["admin", "contract_officer"]
            ).limit(1).execute()
            owner_id = admins.data[0]["id"] if admins.data else None

        if not owner_id:
            logger.warning("Pipeline: no owner found for auto-submission", opp_id=opp_id)
            return None

        portal = "SAM.gov" if opportunity.get("source", "").lower() == "sam" else (opportunity.get("source") or "unknown")
        now = datetime.now(timezone.utc).isoformat()

        sub = db.table("submissions").insert({
            "opportunity_id": opp_id,
            "owner_id": owner_id,
            "title": opportunity.get("title", "Auto-draft"),
            "portal": portal,
            "due_date": opportunity.get("due_date", now),
            "status": "draft",
            "notes": f"Auto-created by pipeline orchestrator (fit={opportunity.get('fit_score', '?')})",
        }).execute()

        if not sub.data:
            return None

        submission_id = sub.data[0]["id"]

        # Create default tasks
        default_tasks = [
            {"submission_id": submission_id, "title": "Complete Checklist", "subtitle": "Review and complete all required fields"},
            {"submission_id": submission_id, "title": "Upload Documents", "subtitle": "Attach all required documents"},
            {"submission_id": submission_id, "title": "Legal Review", "subtitle": "Obtain legal department approval", "locked": True},
            {"submission_id": submission_id, "title": "Finance Review", "subtitle": "Obtain finance department approval", "locked": True},
            {"submission_id": submission_id, "title": "Final Review", "subtitle": "Complete final review before submission", "locked": True},
        ]
        db.table("submission_tasks").insert(default_tasks).execute()

        return submission_id

    except Exception as e:
        logger.error("Pipeline: failed to auto-create submission", error=str(e)[:300])
        return None

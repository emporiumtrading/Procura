"""
Discovery Tasks
Celery tasks for scheduled opportunity discovery.
After each run, new opportunities are auto-qualified and high-fit ones trigger notifications.
"""
import asyncio
from datetime import datetime, timedelta, timezone
import structlog

from .celery_app import celery_app
from ..database import get_supabase_client
from ..config import settings
from ..scrapers import GovConAPIConnector, SAMGovConnector, USASpendingConnector, GrantsGovConnector

logger = structlog.get_logger()

CONNECTORS = {
    "govcon": (GovConAPIConnector, "GOVCON_API_KEY"),
    "sam": (SAMGovConnector, "SAM_GOV_API_KEY"),
    "usaspending": (USASpendingConnector, None),
    "grants_gov": (GrantsGovConnector, None),  # No key required
}


@celery_app.task(bind=True, max_retries=3)
def run_discovery_task(self, connector_name: str, since_days: int = 7):
    """
    Celery task to run discovery for a specific connector, then auto-qualify
    new opportunities and send notifications for high-fit matches.
    """
    return asyncio.run(_run_discovery(connector_name, since_days, self.request.id))


async def _run_discovery(connector_name: str, since_days: int, task_id: str):
    """Async discovery implementation."""
    from ..api_keys import get_api_key
    from ..security.vault import decrypt_credentials
    from ..ai.qualification import qualify_opportunity as ai_qualify, is_prefilter_pass
    from ..routers.company_profile import get_company_profile
    from ..routers.opportunities import _send_opportunity_notifications, _NOTIFY_FIT_THRESHOLD

    supabase = get_supabase_client()
    start_time = datetime.now(timezone.utc)

    # Create run record
    run = supabase.table("discovery_runs").insert({
        "connector_name": connector_name,
        "run_type": "scheduled",
        "status": "running",
        "start_time": start_time.isoformat(),
    }).execute()
    run_id = run.data[0]["id"]

    try:
        entry = CONNECTORS.get(connector_name)
        if not entry:
            raise ValueError(f"Unknown connector: {connector_name}")
        connector_class, key_env = entry

        # Resolve API key: DB connector record → env var
        api_key = None
        connector_record = supabase.table("connectors").select("*").eq("name", connector_name).execute()
        if connector_record.data:
            try:
                creds = decrypt_credentials(connector_record.data[0]["encrypted_credentials"])
                api_key = creds.get("api_key")
            except Exception:
                pass

        if not api_key and key_env:
            api_key = get_api_key(key_env)

        # Run discovery
        since = datetime.now(timezone.utc) - timedelta(days=since_days)
        async with connector_class(api_key=api_key) as connector:
            result = await connector.run_discovery(since)

        opps = result.get("opportunities", [])

        # ── Upsert all discovered opportunities ──────────────────────────────
        created_ids: list[str] = []
        for opp in opps:
            try:
                existing = supabase.table("opportunities") \
                    .select("id, fit_score") \
                    .eq("external_ref", opp["external_ref"]) \
                    .execute()

                if existing.data:
                    supabase.table("opportunities").update(opp).eq("id", existing.data[0]["id"]).execute()
                    # Re-qualify if this is a known opp without scores
                    if existing.data[0].get("fit_score") is None:
                        created_ids.append(existing.data[0]["id"])
                else:
                    inserted = supabase.table("opportunities").insert(opp).execute()
                    if inserted.data:
                        created_ids.append(inserted.data[0]["id"])
            except Exception as e:
                logger.warning("Failed to upsert opportunity", error=str(e)[:200])

        # ── Auto-qualify new/unscored opportunities ──────────────────────────
        profile = get_company_profile()
        qualified = 0
        notified = 0

        if created_ids:
            rows = supabase.table("opportunities").select("*").in_("id", created_ids).execute()
            for opp_row in rows.data or []:
                try:
                    if not is_prefilter_pass(opp_row, profile):
                        continue

                    analysis = await ai_qualify(opp_row, force_refresh=False)
                    fit = analysis.get("fit_score", 0)
                    supabase.table("opportunities").update({
                        "fit_score": analysis.get("fit_score"),
                        "effort_score": analysis.get("effort_score"),
                        "urgency_score": analysis.get("urgency_score"),
                        "ai_summary": analysis.get("summary"),
                    }).eq("id", opp_row["id"]).execute()
                    qualified += 1

                    if fit >= _NOTIFY_FIT_THRESHOLD:
                        _send_opportunity_notifications(supabase, opp_row, fit)
                        notified += 1

                    # Run pipeline orchestrator (may auto-create submissions in supervised/autonomous modes)
                    try:
                        from ..workflows.pipeline import run_pipeline
                        updated_opp = {**opp_row, "fit_score": fit}
                        await run_pipeline(updated_opp, fit)
                    except Exception as pe:
                        logger.warning("Pipeline orchestration failed", opp_id=opp_row.get("id"), error=str(pe)[:200])

                except Exception as e:
                    logger.warning("Auto-qualification failed", opp_id=opp_row.get("id"), error=str(e)[:200])

        # ── Update run record ────────────────────────────────────────────────
        end_time = datetime.now(timezone.utc)
        supabase.table("discovery_runs").update({
            "status": "success",
            "end_time": end_time.isoformat(),
            "duration_ms": int((end_time - start_time).total_seconds() * 1000),
            "records_fetched": result.get("records_fetched", 0),
            "opportunities_created": len(created_ids),
            "opportunities_updated": len(opps) - len(created_ids),
            "errors": len(result.get("errors", [])),
        }).eq("id", run_id).execute()

        if connector_record.data:
            supabase.table("connectors").update({
                "last_run_at": end_time.isoformat(),
                "last_success_at": end_time.isoformat(),
                "error_count": 0,
            }).eq("id", connector_record.data[0]["id"]).execute()

        logger.info(
            "Scheduled discovery completed",
            connector=connector_name,
            total=len(opps),
            new=len(created_ids),
            qualified=qualified,
            notified=notified,
        )
        return {"success": True, "fetched": len(opps), "new": len(created_ids), "qualified": qualified, "notified": notified}

    except Exception as e:
        logger.error("Discovery task failed", connector=connector_name, error=str(e))
        supabase.table("discovery_runs").update({
            "status": "failed",
            "end_time": datetime.now(timezone.utc).isoformat(),
            "error_message": str(e)[:500],
        }).eq("id", run_id).execute()
        raise

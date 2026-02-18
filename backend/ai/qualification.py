"""
AI Qualification Engine
Scores opportunities using LLM for Fit, Effort, and Urgency.
Scores are personalized against the saved company profile when one exists.
"""
from typing import Dict, Optional
from datetime import datetime, date
import structlog

from .llm_client import LLMClient, get_llm_client
from ..database import get_supabase_client

logger = structlog.get_logger()


# ─────────────────────────────────────────────────────────────────────────────
# Prompt templates
# ─────────────────────────────────────────────────────────────────────────────

# Used when a company profile is saved (personalized scoring)
_PERSONALIZED_PROMPT = """You are a government contract bid/no-bid analyst.
Evaluate this opportunity against the company profile below and return qualification scores.

**Company Profile:**
- Company: {company_name}
- NAICS Codes Registered: {naics_codes}
- Certifications: {certifications}
- Set-Aside Eligibility: {set_aside_types}
- Contract Value Range: {value_range}
- Core Capabilities: {capabilities}
- Industry Keywords: {keywords}
- Past Performance Areas: {past_performance_summary}
- Preferred Agencies: {preferred_agencies}

**Opportunity:**
- Title: {title}
- Agency: {agency}
- NAICS Code: {naics_code}
- Set-Aside: {set_aside}
- Posted: {posted_date}  |  Due: {due_date}
- Estimated Value: ${estimated_value}
- Description: {description}

**Scoring Instructions:**

1. **Fit Score (0-100)** — How well does this match THIS company specifically?
   Consider: NAICS code alignment, set-aside eligibility, capabilities match,
   value within preferred range, agency preference.
   - 85-100: Excellent — NAICS match, eligible set-aside, clear capability match
   - 65-84: Good — related NAICS, likely eligible, capabilities apply
   - 45-64: Moderate — adjacent capabilities, partial eligibility
   - 0-44: Poor — outside NAICS scope, ineligible set-aside, or value mismatch

2. **Effort Score (0-100)** — How resource-intensive is this opportunity?
   - 80-100: Very high — large team, >12 month PoP, complex requirements
   - 60-79: High — significant resources, 6-12 months
   - 40-59: Moderate — standard project, 3-6 months
   - 0-39: Low — small, straightforward, <3 months

3. **Urgency Score (0-100)** — Time-sensitivity of the deadline.
   - 80-100: Critical — due within 7 days
   - 60-79: High — due within 14 days
   - 40-59: Moderate — due within 30 days
   - 0-39: Low — over 30 days out

Respond with ONLY valid JSON:
{{
  "fit_score": <number 0-100>,
  "effort_score": <number 0-100>,
  "urgency_score": <number 0-100>,
  "summary": "<2-3 sentences: is this a good bid? why or why not, specific to this company>",
  "reasoning": {{
    "fit": "<specific explanation referencing NAICS match, certifications, value range>",
    "effort": "<brief explanation>",
    "urgency": "<brief explanation>"
  }}
}}
"""

# Fallback when no company profile exists (generic scoring)
_GENERIC_PROMPT = """Analyze this government contract opportunity and provide qualification scores.

**Opportunity Details:**
- Title: {title}
- Agency: {agency}
- Description: {description}
- NAICS Code: {naics_code}
- Set-Aside: {set_aside}
- Posted Date: {posted_date}
- Due Date: {due_date}
- Estimated Value: ${estimated_value}

**Scoring Criteria:**

1. **Fit Score (0-100)**: How well does this opportunity align with typical IT services,
   software development, cloud infrastructure, or consulting capabilities?
   - 80-100: Perfect fit - direct match to core capabilities
   - 60-79: Good fit - related to core capabilities
   - 40-59: Moderate fit - some relevant capabilities
   - 0-39: Poor fit - outside typical capabilities

2. **Effort Score (0-100)**: How complex and resource-intensive is this opportunity?
   - 80-100: Very high effort - large team, long timeline, complex requirements
   - 60-79: High effort - significant resources needed
   - 40-59: Moderate effort - standard project size
   - 0-39: Low effort - small, straightforward project

3. **Urgency Score (0-100)**: How time-sensitive is the deadline?
   - 80-100: Critical - due within 7 days
   - 60-79: High urgency - due within 14 days
   - 40-59: Moderate - due within 30 days
   - 0-39: Low urgency - over 30 days

Tip: Set a Company Profile in Settings > Company Profile for personalized scores.

Respond with ONLY valid JSON:
{{
  "fit_score": <number>,
  "effort_score": <number>,
  "urgency_score": <number>,
  "summary": "<2-3 sentence summary of why this is or isn't a good fit>",
  "reasoning": {{
    "fit": "<brief explanation>",
    "effort": "<brief explanation>",
    "urgency": "<brief explanation>"
  }}
}}
"""


# ─────────────────────────────────────────────────────────────────────────────
# Pre-filtering helpers (cheap — no LLM call)
# ─────────────────────────────────────────────────────────────────────────────

def _naics_matches(opp_naics: Optional[str], company_naics: list) -> bool:
    """True if the opportunity NAICS starts with any registered company NAICS prefix."""
    if not opp_naics or not company_naics:
        return True  # no data → don't filter out
    opp = opp_naics.strip()
    for cn in company_naics:
        prefix = str(cn).strip()
        if opp.startswith(prefix) or prefix.startswith(opp[:4]):
            return True
    return False


def _value_in_range(
    estimated_value: Optional[float],
    min_val: Optional[float],
    max_val: Optional[float],
) -> bool:
    """True if estimated_value is within [min_val, max_val]. None bounds are open."""
    if estimated_value is None:
        return True  # unknown value → don't filter out
    if min_val is not None and estimated_value < min_val:
        return False
    if max_val is not None and estimated_value > max_val:
        return False
    return True


def _set_aside_eligible(opp_set_aside: Optional[str], eligible_types: list) -> bool:
    """True if the opportunity set-aside matches company eligibility (or is unrestricted)."""
    if not opp_set_aside or opp_set_aside.lower() in ("none", "total small business", ""):
        return True
    if not eligible_types:
        return True
    opp_lower = opp_set_aside.lower()
    for cert in eligible_types:
        if cert.lower() in opp_lower or opp_lower in cert.lower():
            return True
    return False


def is_prefilter_pass(opportunity: Dict, profile: dict) -> bool:
    """
    Cheap pre-filter before calling the LLM.
    Returns False only when we are highly confident this is a non-starter.
    """
    if not profile:
        return True

    naics_ok = _naics_matches(
        opportunity.get("naics_code"),
        profile.get("naics_codes", [])
    )
    value_ok = _value_in_range(
        opportunity.get("estimated_value"),
        profile.get("min_contract_value"),
        profile.get("max_contract_value"),
    )
    set_aside_ok = _set_aside_eligible(
        opportunity.get("set_aside"),
        profile.get("set_aside_types", []) + profile.get("certifications", []),
    )

    return naics_ok and value_ok and set_aside_ok


# ─────────────────────────────────────────────────────────────────────────────
# Prompt builder
# ─────────────────────────────────────────────────────────────────────────────

def _build_prompt(opportunity: Dict, profile: dict) -> str:
    if not profile or not profile.get("company_name"):
        return _GENERIC_PROMPT.format(
            title=opportunity.get("title", "Unknown"),
            agency=opportunity.get("agency", "Unknown"),
            description=(opportunity.get("description") or "No description provided")[:1500],
            naics_code=opportunity.get("naics_code") or "Not specified",
            set_aside=opportunity.get("set_aside") or "None",
            posted_date=opportunity.get("posted_date", "Unknown"),
            due_date=opportunity.get("due_date", "Unknown"),
            estimated_value=opportunity.get("estimated_value") or "Not specified",
        )

    # Past performance summary (top 3 entries)
    pp = profile.get("past_performance", [])[:3]
    pp_summary = "; ".join(
        f"{e.get('title','?')} ({e.get('agency','?')}, ${e.get('value',0):,.0f})"
        for e in pp if isinstance(e, dict)
    ) or "None on file"

    min_v = profile.get("min_contract_value")
    max_v = profile.get("max_contract_value")
    if min_v and max_v:
        value_range = f"${min_v:,.0f} – ${max_v:,.0f}"
    elif min_v:
        value_range = f">${min_v:,.0f}"
    elif max_v:
        value_range = f"<${max_v:,.0f}"
    else:
        value_range = "No preference"

    return _PERSONALIZED_PROMPT.format(
        company_name=profile.get("company_name", "Unknown"),
        naics_codes=", ".join(profile.get("naics_codes", [])) or "Not configured",
        certifications=", ".join(profile.get("certifications", [])) or "None",
        set_aside_types=", ".join(profile.get("set_aside_types", [])) or "Unrestricted only",
        value_range=value_range,
        capabilities=(profile.get("capabilities") or "Not specified")[:500],
        keywords=", ".join(profile.get("keywords", [])) or "Not specified",
        past_performance_summary=pp_summary,
        preferred_agencies=", ".join(profile.get("preferred_agencies", [])) or "No preference",
        title=opportunity.get("title", "Unknown"),
        agency=opportunity.get("agency", "Unknown"),
        naics_code=opportunity.get("naics_code") or "Not specified",
        set_aside=opportunity.get("set_aside") or "None",
        posted_date=opportunity.get("posted_date", "Unknown"),
        due_date=opportunity.get("due_date", "Unknown"),
        estimated_value=opportunity.get("estimated_value") or "Not specified",
        description=(opportunity.get("description") or "No description provided")[:1500],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Main qualification function
# ─────────────────────────────────────────────────────────────────────────────

async def qualify_opportunity(opportunity: Dict, force_refresh: bool = False) -> Dict:
    """
    Qualify an opportunity using AI analysis.
    Automatically injects company profile for personalized scoring.
    Returns scores dict with fit_score, effort_score, urgency_score, summary, reasoning.
    """
    from ..routers.company_profile import get_company_profile

    supabase = get_supabase_client()
    opp_id = opportunity.get("id")

    # Check cache unless force refresh
    if not force_refresh and opp_id:
        try:
            cache = supabase.table("llm_cache").select("response").eq("opportunity_id", opp_id).execute()
            if cache.data:
                logger.info("Using cached qualification", opportunity_id=opp_id)
                return cache.data[0]["response"]
        except Exception as e:
            logger.warning("LLM cache unavailable; continuing without cache", error=str(e)[:200])

    # Days until due (for fallback urgency score)
    due_date = opportunity.get("due_date")
    if isinstance(due_date, str):
        try:
            due_date = datetime.strptime(due_date, "%Y-%m-%d").date()
        except Exception:
            due_date = None
    days_until_due = (due_date - date.today()).days if due_date else 30

    # Load company profile for personalized scoring
    profile = get_company_profile()

    # Build the prompt
    prompt = _build_prompt(opportunity, profile)

    try:
        llm = get_llm_client()
        result = await llm.analyze_json(prompt)

        # Clamp scores to [0, 100]
        for key in ("fit_score", "effort_score", "urgency_score"):
            if key in result:
                result[key] = max(0, min(100, int(result[key])))

        # Tag whether personalized scoring was used
        result["_personalized"] = bool(profile and profile.get("company_name"))

        # Cache result
        if opp_id:
            import hashlib
            prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()
            try:
                supabase.table("llm_cache").insert({
                    "opportunity_id": opp_id,
                    "prompt_hash": prompt_hash,
                    "provider": llm.provider,
                    "model": llm.model,
                    "response": result,
                }).execute()
            except Exception as e:
                logger.warning("Failed to write llm_cache; continuing", error=str(e)[:200])

        logger.info(
            "Opportunity qualified",
            opportunity_id=opp_id,
            personalized=result.get("_personalized"),
            fit=result.get("fit_score"),
        )
        return result

    except Exception as e:
        logger.error("Qualification failed", opportunity_id=opp_id, error=str(e))
        return {
            "fit_score": 50,
            "effort_score": 50,
            "urgency_score": max(0, min(100, 100 - days_until_due * 3)),
            "summary": "AI qualification unavailable — scores are estimates.",
            "reasoning": {"error": str(e)},
        }

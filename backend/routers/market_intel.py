"""
Market Intelligence Router
Provides agency spending trends, incumbent analysis, and NAICS market data
sourced from USAspending.gov — no API key required.

Endpoints:
  GET /api/market-intel/naics/{naics_code}   — spend + top winners by NAICS
  GET /api/market-intel/agency/{agency_name} — spending trend for an agency
  GET /api/market-intel/incumbents           — top vendors in your NAICS codes
  GET /api/market-intel/summary              — portfolio-level market snapshot
"""
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
import httpx
import structlog

from ..dependencies import get_current_user

logger = structlog.get_logger()

router = APIRouter()

USA_SPENDING_BASE = "https://api.usaspending.gov/api/v2"
_HTTP_TIMEOUT = 20.0


async def _usaspending_post(endpoint: str, payload: dict) -> dict:
    """POST to USAspending API and return JSON. Raises on HTTP error."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.post(
            f"{USA_SPENDING_BASE}{endpoint}",
            json=payload,
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


async def _usaspending_get(endpoint: str, params: dict = None) -> dict:
    """GET from USAspending API and return JSON."""
    async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
        resp = await client.get(
            f"{USA_SPENDING_BASE}{endpoint}",
            params=params or {},
            headers={"Content-Type": "application/json"},
        )
        resp.raise_for_status()
        return resp.json()


# ── NAICS Market Analysis ─────────────────────────────────────────────────────

@router.get("/naics/{naics_code}")
async def naics_market_analysis(
    naics_code: str,
    fiscal_year: int = Query(default=None, description="Fiscal year (defaults to current FY)"),
    limit: int = Query(default=10, ge=1, le=25),
    user: dict = Depends(get_current_user),
):
    """
    Market analysis for a NAICS code:
    - Total federal spend
    - Top agencies awarding in this code
    - Top incumbent vendors (potential teaming partners or competitors)
    """
    fy = fiscal_year or _current_fy()

    try:
        # Total spend + agency breakdown
        agency_payload = {
            "filters": {
                "naics_codes": [naics_code],
                "time_period": [{"start_date": f"{fy - 1}-10-01", "end_date": f"{fy}-09-30"}],
                "award_type_codes": ["A", "B", "C", "D"],
            },
            "category": "awarding_agency",
            "limit": limit,
            "page": 1,
        }
        agency_data = await _usaspending_post("/search/spending_by_category/awarding_agency/", agency_payload)

        # Top vendors
        vendor_payload = {
            "filters": {
                "naics_codes": [naics_code],
                "time_period": [{"start_date": f"{fy - 1}-10-01", "end_date": f"{fy}-09-30"}],
                "award_type_codes": ["A", "B", "C", "D"],
            },
            "category": "recipient",
            "limit": limit,
            "page": 1,
        }
        vendor_data = await _usaspending_post("/search/spending_by_category/recipient/", vendor_payload)

        top_agencies = [
            {
                "name": r.get("name", "Unknown"),
                "amount": r.get("aggregated_amount", 0),
                "count": r.get("total_distinct_awards", 0),
            }
            for r in (agency_data.get("results") or [])[:limit]
        ]

        top_vendors = [
            {
                "name": r.get("name", "Unknown"),
                "amount": r.get("aggregated_amount", 0),
                "uei": r.get("uei"),
            }
            for r in (vendor_data.get("results") or [])[:limit]
        ]

        total_spend = sum(a["amount"] for a in top_agencies)

        return {
            "naics_code": naics_code,
            "fiscal_year": fy,
            "total_federal_spend": total_spend,
            "top_agencies": top_agencies,
            "top_vendors": top_vendors,
            "insight": _naics_insight(naics_code, total_spend, top_agencies, top_vendors),
        }

    except httpx.HTTPStatusError as e:
        logger.warning("USAspending NAICS query failed", naics=naics_code, status=e.response.status_code)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"USAspending API returned {e.response.status_code}",
        )
    except Exception as e:
        logger.error("NAICS market analysis failed", naics=naics_code, error=str(e)[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Market analysis temporarily unavailable",
        )


# ── Agency Spending Trend ─────────────────────────────────────────────────────

@router.get("/agency")
async def agency_spending_trend(
    name: str = Query(..., description="Agency name to search for"),
    years: int = Query(default=3, ge=1, le=5),
    user: dict = Depends(get_current_user),
):
    """
    Multi-year spending trend for an agency.
    Useful for understanding budget trajectory before pursuing.
    """
    current_fy = _current_fy()
    trend = []

    for fy in range(current_fy - years + 1, current_fy + 1):
        try:
            payload = {
                "filters": {
                    "agencies": [{"type": "awarding", "tier": "subtier", "name": name}],
                    "time_period": [{"start_date": f"{fy - 1}-10-01", "end_date": f"{fy}-09-30"}],
                    "award_type_codes": ["A", "B", "C", "D"],
                },
                "category": "recipient",
                "limit": 1,
                "page": 1,
            }
            data = await _usaspending_post("/search/spending_by_category/recipient/", payload)
            # Use metadata total if available
            total = data.get("category_count", 0) or 0
            # Approximate total from results sum
            results = data.get("results") or []
            approx_total = sum(r.get("aggregated_amount", 0) for r in results)
            trend.append({"fiscal_year": fy, "obligations": approx_total, "award_count": total})
        except Exception:
            trend.append({"fiscal_year": fy, "obligations": None, "award_count": None})

    direction = _trend_direction([t["obligations"] for t in trend if t["obligations"] is not None])

    return {
        "agency": name,
        "years_analyzed": years,
        "trend": trend,
        "direction": direction,
        "insight": f"Agency spending is {direction} over the last {years} fiscal years.",
    }


# ── Portfolio Incumbents ──────────────────────────────────────────────────────

@router.get("/incumbents")
async def portfolio_incumbents(
    naics_codes: str = Query(..., description="Comma-separated NAICS codes from company profile"),
    limit: int = Query(default=15, ge=1, le=25),
    user: dict = Depends(get_current_user),
):
    """
    Top incumbents across all NAICS codes in your company profile.
    Helps identify teaming partners and competitive intelligence.
    """
    fy = _current_fy()
    codes = [c.strip() for c in naics_codes.split(",") if c.strip()][:10]

    if not codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="naics_codes required")

    try:
        payload = {
            "filters": {
                "naics_codes": codes,
                "time_period": [{"start_date": f"{fy - 1}-10-01", "end_date": f"{fy}-09-30"}],
                "award_type_codes": ["A", "B", "C", "D"],
            },
            "category": "recipient",
            "limit": limit,
            "page": 1,
        }
        data = await _usaspending_post("/search/spending_by_category/recipient/", payload)
        vendors = [
            {
                "name": r.get("name", "Unknown"),
                "amount": r.get("aggregated_amount", 0),
                "uei": r.get("uei"),
                "rank": i + 1,
            }
            for i, r in enumerate(data.get("results") or [])
        ]

        return {
            "naics_codes": codes,
            "fiscal_year": fy,
            "incumbents": vendors,
            "insight": f"Top {len(vendors)} vendors across {len(codes)} NAICS code(s) in FY{fy}.",
        }

    except httpx.HTTPStatusError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"USAspending API returned {e.response.status_code}",
        )
    except Exception as e:
        logger.error("Incumbents query failed", error=str(e)[:200])
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Market intelligence temporarily unavailable",
        )


# ── Portfolio Summary ─────────────────────────────────────────────────────────

@router.get("/summary")
async def market_summary(
    naics_codes: str = Query(..., description="Comma-separated NAICS codes from company profile"),
    user: dict = Depends(get_current_user),
):
    """
    High-level market snapshot for the company's NAICS portfolio.
    Returned as a quick-read card for the Market Intel page.
    """
    fy = _current_fy()
    codes = [c.strip() for c in naics_codes.split(",") if c.strip()][:10]

    if not codes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="naics_codes required")

    totals_by_naics = []
    for code in codes:
        try:
            payload = {
                "filters": {
                    "naics_codes": [code],
                    "time_period": [{"start_date": f"{fy - 1}-10-01", "end_date": f"{fy}-09-30"}],
                    "award_type_codes": ["A", "B", "C", "D"],
                },
                "category": "awarding_agency",
                "limit": 3,
                "page": 1,
            }
            data = await _usaspending_post("/search/spending_by_category/awarding_agency/", payload)
            results = data.get("results") or []
            total = sum(r.get("aggregated_amount", 0) for r in results)
            top_agency = results[0].get("name") if results else "—"
            totals_by_naics.append({"naics": code, "total_spend": total, "top_agency": top_agency})
        except Exception:
            totals_by_naics.append({"naics": code, "total_spend": None, "top_agency": "—"})

    grand_total = sum(t["total_spend"] or 0 for t in totals_by_naics)

    return {
        "fiscal_year": fy,
        "naics_codes": codes,
        "by_naics": totals_by_naics,
        "total_addressable_market": grand_total,
        "insight": f"Your NAICS portfolio addresses ${grand_total / 1e9:.1f}B in FY{fy} federal spend." if grand_total else "Run market analysis to see your addressable market.",
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _current_fy() -> int:
    """Return current US federal fiscal year (Oct 1 – Sep 30)."""
    now = datetime.now(timezone.utc)
    return now.year if now.month < 10 else now.year + 1


def _trend_direction(values: list) -> str:
    if len(values) < 2:
        return "stable"
    valid = [v for v in values if v is not None]
    if len(valid) < 2:
        return "unknown"
    delta = (valid[-1] - valid[0]) / max(abs(valid[0]), 1)
    if delta > 0.1:
        return "increasing"
    if delta < -0.1:
        return "decreasing"
    return "stable"


def _naics_insight(naics_code: str, total_spend: float, agencies: list, vendors: list) -> str:
    top_agency = agencies[0]["name"] if agencies else "unknown agencies"
    top_vendor = vendors[0]["name"] if vendors else "unknown vendors"
    spend_b = total_spend / 1e9 if total_spend >= 1e9 else None
    spend_m = total_spend / 1e6 if total_spend >= 1e6 else None
    spend_str = f"${spend_b:.1f}B" if spend_b else (f"${spend_m:.0f}M" if spend_m else f"${total_spend:,.0f}")
    return (
        f"NAICS {naics_code} had {spend_str} in federal obligations this fiscal year. "
        f"Largest buyer: {top_agency}. Largest vendor: {top_vendor}."
    )

"""
Grants.gov Connector
Fetches federal grant opportunities from Grants.gov public REST API.
No API key required — Grants.gov is a publicly accessible data source.

API reference: https://www.grants.gov/web/grants/s2s/applicant/get-opportunities.html
Search endpoint: POST https://apply07.grants.gov/grantsws/rest/opportunities/search
"""
from typing import List, Dict, Optional
from datetime import datetime, timezone
import structlog

from .base import BaseConnector

logger = structlog.get_logger()


class GrantsGovConnector(BaseConnector):
    """Connector for Grants.gov REST API"""

    name = "grants_gov"
    source = "grants.gov"
    base_url = "https://apply07.grants.gov/grantsws/rest"

    def get_headers(self) -> Dict[str, str]:
        """Grants.gov public API — no auth required."""
        return {"Content-Type": "application/json"}

    async def fetch_opportunities(self, since: Optional[datetime] = None) -> List[Dict]:
        """
        Fetch active grant opportunities from Grants.gov.
        Targets IT, software, cloud, and R&D categories.
        """
        # IT / tech-relevant CFDA categories and keywords
        it_keywords = [
            "information technology", "software", "cloud computing",
            "cybersecurity", "data management", "artificial intelligence",
            "digital services", "technology modernization",
        ]

        all_results: List[Dict] = []
        seen_ids: set = set()

        for keyword in it_keywords[:4]:  # Limit to 4 keywords to avoid rate limits
            try:
                payload = {
                    "keyword": keyword,
                    "oppStatuses": "posted",
                    "rows": 25,
                    "startRecordNum": 0,
                    "sortBy": "openDate|desc",
                }
                response = await self._request(
                    "POST",
                    f"{self.base_url}/opportunities/search",
                    json=payload,
                )
                data = response.json()
                opps = data.get("oppHits", []) or []

                for opp in opps:
                    opp_id = opp.get("id") or opp.get("oppNumber")
                    if opp_id and opp_id not in seen_ids:
                        seen_ids.add(opp_id)
                        all_results.append(opp)

            except Exception as e:
                logger.warning("Grants.gov keyword search failed", keyword=keyword, error=str(e)[:200])

        logger.info("Fetched from Grants.gov", count=len(all_results))
        return all_results

    def normalize(self, raw: Dict) -> Dict:
        """Normalize Grants.gov opportunity to standard format."""
        opp_id = raw.get("id") or raw.get("oppNumber") or raw.get("number")
        title = raw.get("title") or raw.get("oppTitle") or "Untitled Grant"
        agency = raw.get("agencyName") or raw.get("agency") or "Federal Agency"

        # Parse dates — Grants.gov returns milliseconds epoch or string
        def _parse_date(val) -> Optional[str]:
            if not val:
                return None
            if isinstance(val, (int, float)):
                try:
                    return datetime.fromtimestamp(val / 1000, tz=timezone.utc).date().isoformat()
                except Exception:
                    return None
            return str(val)[:10]  # take YYYY-MM-DD portion

        close_date = _parse_date(raw.get("closeDate") or raw.get("closingDate"))
        open_date = _parse_date(raw.get("openDate") or raw.get("postingDate"))

        award_floor = raw.get("awardCeiling") or raw.get("estimatedTotalProgramFunding")
        try:
            estimated_value = float(award_floor) if award_floor else None
        except (TypeError, ValueError):
            estimated_value = None

        description_parts = []
        if raw.get("synopsis"):
            description_parts.append(raw["synopsis"])
        if raw.get("description"):
            description_parts.append(raw["description"])
        description = " ".join(description_parts)[:3000] or title

        return {
            "external_ref": f"GRANTS-{opp_id}" if opp_id else None,
            "title": title[:500],
            "agency": agency[:200],
            "description": description,
            "naics_code": raw.get("cfdaList", [None])[0] if raw.get("cfdaList") else None,
            "set_aside": None,  # Grants.gov doesn't use set-asides (grant-specific)
            "posted_date": open_date,
            "due_date": close_date,
            "estimated_value": estimated_value,
            "notice_type": "grant",
            "raw_data": {
                "source": "grants.gov",
                "opportunity_number": raw.get("number") or raw.get("oppNumber"),
                "cfda_numbers": raw.get("cfdaList", []),
                "expected_awards": raw.get("expectedNumberOfAwards"),
                "eligibility": raw.get("applicantEligibilityDesc") or raw.get("eligibleApplicants"),
            },
        }

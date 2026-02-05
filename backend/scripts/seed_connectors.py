"""
Seed connector records in Supabase for local development.

Why this exists:
- Discovery tasks read API keys from the `connectors` table (encrypted at rest),
  not directly from environment variables.
- This script bootstraps those rows from `backend/.env` so discovery can run.

Usage (PowerShell):
  cd C:\\Users\\Rethick\\procura-ops-command
  backend\\venv\\Scripts\\python.exe backend/scripts/seed_connectors.py
"""

from __future__ import annotations

from dataclasses import dataclass
import os
import sys

# Allow running as a script: `python backend/scripts/seed_connectors.py`
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from supabase import create_client  # noqa: E402
from backend.config import settings  # noqa: E402
from backend.security.vault import encrypt_credentials  # noqa: E402


@dataclass(frozen=True)
class ConnectorSeed:
    name: str
    label: str
    auth_type: str
    api_key: str | None
    portal_url: str | None = None


def _is_placeholder(value: str | None) -> bool:
    if not value:
        return True
    v = value.strip()
    if not v:
        return True
    upper = v.upper()
    return upper == "PLACEHOLDER" or "PLACEHOLDER" in upper or v.startswith("your-")


def main() -> None:
    # Fail fast if encryption isn't configured; without this we can't seed creds.
    if not settings.VAULT_ENCRYPTION_KEY:
        raise SystemExit("VAULT_ENCRYPTION_KEY is missing in backend/.env")

    # Seeding connectors requires elevated privileges (bypasses RLS).
    if _is_placeholder(settings.SUPABASE_SERVICE_ROLE_KEY):
        raise SystemExit(
            "SUPABASE_SERVICE_ROLE_KEY is missing/invalid in backend/.env. "
            "Get it from Supabase Dashboard -> Project Settings -> API -> service_role key."
        )

    seeds: list[ConnectorSeed] = [
        ConnectorSeed(
            name="govcon",
            label="GovCon API",
            auth_type="bearer",
            api_key=settings.GOVCON_API_KEY,
            portal_url="https://govconapi.com",
        ),
        ConnectorSeed(
            name="sam",
            label="SAM.gov",
            auth_type="api_key",
            api_key=settings.SAM_GOV_API_KEY,
            portal_url="https://sam.gov",
        ),
        ConnectorSeed(
            name="usaspending",
            label="USAspending.gov",
            auth_type="none",
            api_key=None,
            portal_url="https://usaspending.gov",
        ),
    ]

    sb = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)
    try:
        # Sanity check so we fail with a clear message instead of a long stack trace.
        sb.table("system_settings").select("key").limit(1).execute()
    except Exception:
        raise SystemExit(
            "SUPABASE_SERVICE_ROLE_KEY appears to be invalid for this SUPABASE_URL. "
            "Update it from Supabase Dashboard -> Project Settings -> API."
        )

    for seed in seeds:
        creds = {"api_key": seed.api_key} if seed.api_key and not _is_placeholder(seed.api_key) else {}
        encrypted = encrypt_credentials(creds)

        status = "active" if creds else "warning"

        sb.table("connectors").upsert(
            {
                "name": seed.name,
                "label": seed.label,
                "portal_url": seed.portal_url,
                "auth_type": seed.auth_type,
                "encrypted_credentials": encrypted,
                "status": status,
                "rate_limit_per_min": 60,
            },
            on_conflict="name",
        ).execute()

        print(f"seeded {seed.name} status={status}")


if __name__ == "__main__":
    main()

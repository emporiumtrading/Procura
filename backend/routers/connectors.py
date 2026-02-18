"""
Connectors Router
Portal connector management with credential vault
"""
from typing import Optional
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from supabase import Client
import structlog
import httpx

from ..dependencies import require_admin, get_request_supabase
from ..models import (
    ConnectorResponse,
    ConnectorListResponse,
    ConnectorCreate,
    ConnectorUpdate,
    ConnectorStatus,
    BaseResponse,
    DiscoveryRunResponse,
    DiscoveryRunListResponse
)
from ..security.vault import encrypt_credentials, decrypt_credentials

logger = structlog.get_logger()

router = APIRouter()


def _is_placeholder(value: Optional[str]) -> bool:
    if not value:
        return True
    normalized = value.strip()
    if not normalized:
        return True
    upper = normalized.upper()
    return upper == "PLACEHOLDER" or "PLACEHOLDER" in upper or normalized.startswith("your-")


def _extract_secret(credentials: dict, *keys: str) -> Optional[str]:
    for key in keys:
        value = credentials.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


async def _test_sam_connection(api_key: str) -> tuple[bool, str]:
    params = {
        "limit": 1,
        "status": "active",
        "postedFrom": (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%m/%d/%Y"),
        "postedTo": datetime.now(timezone.utc).strftime("%m/%d/%Y"),
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.sam.gov/opportunities/v2/search",
            params=params,
            headers={"X-Api-Key": api_key},
        )
    if response.status_code != 200:
        return False, f"SAM.gov test failed with status {response.status_code}"
    payload = response.json()
    count = len(payload.get("opportunitiesData", []) or [])
    return True, f"SAM.gov reachable ({count} records returned)"


async def _test_govcon_connection(api_key: str) -> tuple[bool, str]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://govconapi.com/api/v1/opportunities/search",
            params={"limit": 1, "offset": 0},
            headers={"Authorization": f"Bearer {api_key}"},
        )
    if response.status_code != 200:
        return False, f"GovCon API test failed with status {response.status_code}"
    payload = response.json()
    count = len(payload.get("data", []) or [])
    return True, f"GovCon API reachable ({count} records returned)"


async def _test_usaspending_connection() -> tuple[bool, str]:
    payload = {
        "filters": {
            "time_period": [
                {
                    "start_date": (datetime.now(timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d"),
                    "end_date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                }
            ],
            "award_type_codes": ["A", "B", "C", "D"],
        },
        "limit": 1,
        "page": 1,
    }
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            "https://api.usaspending.gov/api/v2/search/spending_by_award",
            json=payload,
        )
    if response.status_code != 200:
        return False, f"USAspending test failed with status {response.status_code}"
    payload = response.json()
    count = len(payload.get("results", []) or [])
    return True, f"USAspending reachable ({count} records returned)"


async def _test_generic_portal(portal_url: str) -> tuple[bool, str]:
    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
        response = await client.get(portal_url)
    if response.status_code >= 400:
        return False, f"Portal URL test failed with status {response.status_code}"
    return True, f"Portal reachable (status {response.status_code})"


async def _run_connector_test(connector: dict, credentials: dict) -> tuple[bool, int, str]:
    name = (connector.get("name") or "").strip().lower()

    try:
        if name in {"sam", "sam_gov", "sam.gov"}:
            api_key = _extract_secret(credentials, "api_key", "sam_gov_api_key", "x_api_key")
            if _is_placeholder(api_key):
                return False, status.HTTP_400_BAD_REQUEST, "SAM.gov API key is missing or invalid."
            ok, message = await _test_sam_connection(api_key)
            return ok, status.HTTP_502_BAD_GATEWAY if not ok else status.HTTP_200_OK, message

        if name in {"govcon", "govcon_api", "govconapi"}:
            api_key = _extract_secret(credentials, "api_key", "govcon_api_key", "token")
            if _is_placeholder(api_key):
                return False, status.HTTP_400_BAD_REQUEST, "GovCon API key is missing or invalid."
            ok, message = await _test_govcon_connection(api_key)
            return ok, status.HTTP_502_BAD_GATEWAY if not ok else status.HTTP_200_OK, message

        if name in {"usaspending", "usaspending_api"}:
            ok, message = await _test_usaspending_connection()
            return ok, status.HTTP_502_BAD_GATEWAY if not ok else status.HTTP_200_OK, message

        portal_url = connector.get("portal_url")
        if isinstance(portal_url, str) and portal_url.startswith(("http://", "https://")):
            ok, message = await _test_generic_portal(portal_url)
            return ok, status.HTTP_502_BAD_GATEWAY if not ok else status.HTTP_200_OK, message

        return False, status.HTTP_400_BAD_REQUEST, (
            "No test strategy available for this connector. "
            "Set a known connector name (sam, govcon, usaspending) or a valid portal_url."
        )
    except httpx.TimeoutException:
        return False, status.HTTP_504_GATEWAY_TIMEOUT, "Connector test timed out."
    except httpx.HTTPError as exc:
        return False, status.HTTP_502_BAD_GATEWAY, f"Connector test failed: {str(exc)[:200]}"


@router.get("", response_model=ConnectorListResponse)
async def list_connectors(
    status_filter: Optional[ConnectorStatus] = None,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    List all portal connectors (admin only)
    """
    try:
        query = supabase.table("connectors").select("*")
        
        if status_filter:
            query = query.eq("status", status_filter.value)
        
        response = query.order("name").execute()
        
        # Remove encrypted credentials from response
        connectors = []
        for c in response.data:
            c.pop("encrypted_credentials", None)
            connectors.append(c)
        
        return ConnectorListResponse(success=True, data=connectors)
        
    except Exception as e:
        logger.error("Failed to list connectors", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch connectors"
        )


@router.get("/{connector_id}", response_model=ConnectorResponse)
async def get_connector(
    connector_id: str,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Get a single connector (admin only)
    """
    try:
        response = supabase.table("connectors").select("*").eq("id", connector_id).single().execute()
        
        if not response.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connector not found"
            )
        
        # Remove encrypted credentials
        response.data.pop("encrypted_credentials", None)
        return response.data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to get connector", id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch connector"
        )


@router.post("", response_model=ConnectorResponse, status_code=status.HTTP_201_CREATED)
async def create_connector(
    connector: ConnectorCreate,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Create a new portal connector (admin only)
    """
    try:
        # Check for duplicate name
        existing = supabase.table("connectors").select("id").eq("name", connector.name).execute()
        if existing.data:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Connector '{connector.name}' already exists"
            )
        
        # Encrypt credentials
        encrypted_creds = encrypt_credentials(connector.credentials)
        
        # Create connector
        connector_data = connector.model_dump(exclude={"credentials"})
        connector_data["encrypted_credentials"] = encrypted_creds
        
        response = supabase.table("connectors").insert(connector_data).execute()
        
        logger.info("Connector created", name=connector.name, user_id=user["id"])
        
        # Remove encrypted credentials from response
        result = response.data[0]
        result.pop("encrypted_credentials", None)
        return result
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to create connector", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create connector"
        )


@router.patch("/{connector_id}", response_model=ConnectorResponse)
async def update_connector(
    connector_id: str,
    updates: ConnectorUpdate,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Update a connector (admin only)
    """
    try:
        # Check exists
        existing = supabase.table("connectors").select("id").eq("id", connector_id).execute()
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
        
        # Update
        update_data = {k: v.value if hasattr(v, 'value') else v for k, v in updates.model_dump().items() if v is not None}
        
        if update_data:
            supabase.table("connectors").update(update_data).eq("id", connector_id).execute()
        
        logger.info("Connector updated", id=connector_id, updates=list(update_data.keys()))
        return await get_connector(connector_id, supabase, user)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to update connector", id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update connector"
        )


@router.post("/{connector_id}/rotate", response_model=BaseResponse)
async def rotate_credentials(
    connector_id: str,
    new_credentials: dict,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Rotate credentials for a connector (admin only)
    """
    try:
        # Check exists
        existing = supabase.table("connectors").select("name").eq("id", connector_id).single().execute()
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
        
        # Encrypt new credentials
        encrypted_creds = encrypt_credentials(new_credentials)
        
        # Update
        supabase.table("connectors").update({
            "encrypted_credentials": encrypted_creds,
            "error_count": 0  # Reset error count on rotation
        }).eq("id", connector_id).execute()
        
        logger.info("Credentials rotated", connector=existing.data["name"], user_id=user["id"])
        
        return BaseResponse(success=True, message="Credentials rotated successfully")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to rotate credentials", id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to rotate credentials"
        )


@router.delete("/{connector_id}", response_model=BaseResponse)
async def revoke_connector(
    connector_id: str,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Revoke/disable a connector (admin only)
    """
    try:
        # Verify connector exists
        existing = supabase.table("connectors").select("id").eq("id", connector_id).execute()
        if not existing.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")

        # Soft delete by setting status to revoked
        supabase.table("connectors").update({
            "status": "revoked"
        }).eq("id", connector_id).execute()
        
        logger.info("Connector revoked", id=connector_id, user_id=user["id"])
        
        return BaseResponse(success=True, message="Connector revoked")

    except HTTPException:
        raise
    except Exception as e:
        logger.error("Failed to revoke connector", id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke connector"
        )


@router.get("/{connector_id}/runs", response_model=DiscoveryRunListResponse)
async def get_connector_runs(
    connector_id: str,
    limit: int = 50,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Get run history for a specific connector
    """
    try:
        response = supabase.table("discovery_runs").select("*").eq(
            "connector_id", connector_id
        ).order("start_time", desc=True).limit(limit).execute()
        
        return DiscoveryRunListResponse(success=True, data=response.data)
        
    except Exception as e:
        logger.error("Failed to get runs", connector_id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch run history"
        )


@router.post("/{connector_id}/test", response_model=BaseResponse)
async def test_connector(
    connector_id: str,
    supabase: Client = Depends(get_request_supabase),
    user: dict = Depends(require_admin)
):
    """
    Test connector connectivity
    """
    try:
        # Get connector
        connector = supabase.table("connectors").select("*").eq("id", connector_id).single().execute()
        if not connector.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Connector not found")
        
        # Decrypt credentials
        credentials = decrypt_credentials(connector.data["encrypted_credentials"])

        ok, status_code, message = await _run_connector_test(connector.data, credentials)
        if not ok:
            logger.warning("Connector test failed", id=connector_id, reason=message)
            raise HTTPException(status_code=status_code, detail=message)

        logger.info("Connector test successful", id=connector_id, message=message)

        return BaseResponse(success=True, message=message)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Connector test failed", id=connector_id, error=str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Connection test failed"
        )

"""
Procura Backend - FastAPI Dependencies
Authentication middleware and common dependencies
"""
from typing import Optional
from datetime import datetime, timezone
from collections import defaultdict
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from supabase import Client
import structlog

from .database import get_supabase_user_client
from .config import settings

logger = structlog.get_logger()

security = HTTPBearer(auto_error=False)


async def get_request_supabase(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Client:
    """
    Supabase client authenticated with the caller's JWT.

    Use this for all table operations so RLS is enforced consistently.
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return get_supabase_user_client(credentials.credentials)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    Validate JWT token from Supabase Auth and return user profile
    """
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        token = credentials.credentials

        # Use a user-scoped client so profile queries obey RLS.
        db = get_supabase_user_client(token)
        
        # Verify token with Supabase
        user_response = db.auth.get_user(token)
        
        if not user_response or not user_response.user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token",
            )
        
        user = user_response.user
        
        # Get profile from database
        profile_response = db.table("profiles").select("*").eq("id", user.id).single().execute()
        
        if not profile_response.data:
            # Profile should exist from trigger, but create if missing
            logger.warning("Profile not found for user", user_id=user.id)
            profile = {
                "id": user.id,
                "email": user.email,
                "full_name": user.user_metadata.get("full_name", user.email.split("@")[0]),
                "role": "viewer"
            }
        else:
            profile = profile_response.data
        
        # Update last_active
        db.table("profiles").update({"last_active": datetime.now(timezone.utc).isoformat()}).eq("id", user.id).execute()
        
        return profile
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Auth error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[dict]:
    """
    Same as get_current_user but returns None instead of raising error
    """
    if not credentials:
        return None
    
    try:
        return await get_current_user(credentials)
    except HTTPException:
        return None


def require_role(allowed_roles: list[str]):
    """
    Dependency factory that checks if user has required role
    """
    async def role_checker(user: dict = Depends(get_current_user)) -> dict:
        if user.get("role") not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires one of roles: {allowed_roles}"
            )
        return user
    return role_checker


# Common role dependencies
require_admin = require_role(["admin"])
require_officer = require_role(["admin", "contract_officer"])


class RateLimiter:
    """Sliding window in-memory rate limiter. Use Redis for multi-process production."""

    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def check(self, identifier: str) -> bool:
        now = datetime.now(timezone.utc).timestamp()
        window_start = now - 60.0

        # Prune expired entries
        timestamps = self._requests[identifier]
        self._requests[identifier] = [t for t in timestamps if t > window_start]

        if len(self._requests[identifier]) >= self.requests_per_minute:
            return False

        self._requests[identifier].append(now)
        return True


rate_limiter = RateLimiter(settings.RATE_LIMIT_PER_MINUTE)

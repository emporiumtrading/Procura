"""
Procura Database Client
Supabase client initialization and helper functions
"""
from functools import lru_cache
from typing import Any, Optional
from supabase import create_client, Client
import structlog

from .config import settings

logger = structlog.get_logger()


def _is_placeholder(value: str | None) -> bool:
    if not value:
        return True
    v = value.strip()
    if not v:
        return True
    upper = v.upper()
    return upper == "PLACEHOLDER" or "PLACEHOLDER" in upper or v.startswith("your-")


@lru_cache()
def get_supabase_client() -> Client:
    """
    Get cached Supabase client instance.

    Prefer the service role key (bypasses RLS) but fall back to anon when the
    service role key is missing/invalid (common in local dev).
    """
    service_key = settings.SUPABASE_SERVICE_ROLE_KEY
    anon_key = settings.SUPABASE_ANON_KEY

    if service_key and not _is_placeholder(service_key):
        client = create_client(settings.SUPABASE_URL, service_key)
        try:
            # Lightweight sanity check so a stale/invalid key doesn't break the whole app.
            client.table("system_settings").select("key").limit(1).execute()
            logger.info("Supabase client initialized with service role key")
            return client
        except Exception as e:
            logger.warning("Supabase service role key failed; falling back to anon key", error=str(e)[:200])

    if anon_key and not _is_placeholder(anon_key):
        client = create_client(settings.SUPABASE_URL, anon_key)
        logger.info("Supabase client initialized with anon key")
        return client

    raise ValueError("Supabase keys not configured (set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY)")


def get_db() -> Client:
    """Dependency for FastAPI routes"""
    return get_supabase_client()


def get_supabase_user_client(access_token: str) -> Client:
    """
    Create a Supabase client scoped to an authenticated user.

    This uses the anon key and attaches the user's JWT so PostgREST enforces RLS.
    """
    anon_key = settings.SUPABASE_ANON_KEY
    if not anon_key or _is_placeholder(anon_key):
        raise ValueError("SUPABASE_ANON_KEY is required to create a user-scoped Supabase client")

    client = create_client(settings.SUPABASE_URL, anon_key)
    client.postgrest.auth(access_token)
    return client


class DatabaseHelper:
    """Helper class for common database operations"""
    
    def __init__(self, client: Optional[Client] = None):
        self.client = client or get_supabase_client()
    
    # ===========================================
    # Opportunities
    # ===========================================
    
    async def get_opportunities(
        self,
        status: Optional[str] = None,
        source: Optional[str] = None,
        min_fit_score: Optional[int] = None,
        limit: int = 50,
        offset: int = 0
    ) -> list[dict]:
        """Get opportunities with optional filters"""
        query = self.client.table("opportunities").select("*")
        
        if status:
            query = query.eq("status", status)
        if source:
            query = query.eq("source", source)
        if min_fit_score:
            query = query.gte("fit_score", min_fit_score)
        
        query = query.order("due_date", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        return response.data
    
    async def get_opportunity(self, opportunity_id: str) -> Optional[dict]:
        """Get single opportunity by ID"""
        response = self.client.table("opportunities").select("*").eq("id", opportunity_id).single().execute()
        return response.data
    
    async def create_opportunity(self, opportunity_data: dict) -> dict:
        """Create a new opportunity"""
        response = self.client.table("opportunities").insert(opportunity_data).execute()
        return response.data[0]
    
    async def update_opportunity(self, opportunity_id: str, updates: dict) -> dict:
        """Update an opportunity"""
        response = self.client.table("opportunities").update(updates).eq("id", opportunity_id).execute()
        return response.data[0]
    
    async def upsert_opportunity(self, opportunity_data: dict) -> dict:
        """Upsert opportunity by external_ref"""
        response = self.client.table("opportunities").upsert(
            opportunity_data,
            on_conflict="external_ref"
        ).execute()
        return response.data[0]
    
    # ===========================================
    # Submissions
    # ===========================================
    
    async def get_submissions(
        self,
        owner_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> list[dict]:
        """Get submissions with optional filters"""
        query = self.client.table("submissions").select("*, opportunity:opportunities(*), owner:profiles(*)")
        
        if owner_id:
            query = query.eq("owner_id", owner_id)
        if status:
            query = query.eq("status", status)
        
        query = query.order("due_date", desc=False).range(offset, offset + limit - 1)
        
        response = query.execute()
        return response.data
    
    async def get_submission(self, submission_id: str) -> Optional[dict]:
        """Get single submission with related data"""
        response = self.client.table("submissions").select(
            "*, opportunity:opportunities(*), owner:profiles(*), files:submission_files(*), tasks:submission_tasks(*)"
        ).eq("id", submission_id).single().execute()
        return response.data
    
    async def create_submission(self, submission_data: dict) -> dict:
        """Create a new submission"""
        response = self.client.table("submissions").insert(submission_data).execute()
        return response.data[0]
    
    async def update_submission(self, submission_id: str, updates: dict) -> dict:
        """Update a submission"""
        response = self.client.table("submissions").update(updates).eq("id", submission_id).execute()
        return response.data[0]
    
    # ===========================================
    # Connectors
    # ===========================================
    
    async def get_connectors(self, status: Optional[str] = None) -> list[dict]:
        """Get all connectors"""
        query = self.client.table("connectors").select("*")
        if status:
            query = query.eq("status", status)
        response = query.execute()
        return response.data
    
    async def get_connector(self, connector_id: str) -> Optional[dict]:
        """Get single connector by ID"""
        response = self.client.table("connectors").select("*").eq("id", connector_id).single().execute()
        return response.data
    
    async def get_connector_by_name(self, name: str) -> Optional[dict]:
        """Get connector by name"""
        response = self.client.table("connectors").select("*").eq("name", name).single().execute()
        return response.data
    
    async def create_connector(self, connector_data: dict) -> dict:
        """Create a new connector"""
        response = self.client.table("connectors").insert(connector_data).execute()
        return response.data[0]
    
    async def update_connector(self, connector_id: str, updates: dict) -> dict:
        """Update a connector"""
        response = self.client.table("connectors").update(updates).eq("id", connector_id).execute()
        return response.data[0]
    
    # ===========================================
    # Discovery Runs
    # ===========================================
    
    async def create_discovery_run(self, run_data: dict) -> dict:
        """Create a new discovery run record"""
        response = self.client.table("discovery_runs").insert(run_data).execute()
        return response.data[0]
    
    async def update_discovery_run(self, run_id: str, updates: dict) -> dict:
        """Update a discovery run"""
        response = self.client.table("discovery_runs").update(updates).eq("id", run_id).execute()
        return response.data[0]
    
    async def get_discovery_runs(
        self,
        connector_id: Optional[str] = None,
        limit: int = 50
    ) -> list[dict]:
        """Get discovery run history"""
        query = self.client.table("discovery_runs").select("*")
        if connector_id:
            query = query.eq("connector_id", connector_id)
        query = query.order("start_time", desc=True).limit(limit)
        response = query.execute()
        return response.data
    
    # ===========================================
    # Audit Logs
    # ===========================================
    
    async def create_audit_log(self, log_data: dict) -> dict:
        """Create a new audit log entry"""
        response = self.client.table("audit_logs").insert(log_data).execute()
        return response.data[0]
    
    async def get_audit_logs(
        self,
        submission_id: Optional[str] = None,
        limit: int = 100
    ) -> list[dict]:
        """Get audit logs with optional filter"""
        query = self.client.table("audit_logs").select("*")
        if submission_id:
            query = query.eq("submission_id", submission_id)
        query = query.order("timestamp", desc=True).limit(limit)
        response = query.execute()
        return response.data
    
    # ===========================================
    # System Settings
    # ===========================================
    
    async def get_setting(self, key: str) -> Optional[Any]:
        """Get a system setting"""
        response = self.client.table("system_settings").select("value").eq("key", key).single().execute()
        return response.data["value"] if response.data else None
    
    async def set_setting(self, key: str, value: Any, user_id: Optional[str] = None) -> dict:
        """Set a system setting"""
        response = self.client.table("system_settings").upsert({
            "key": key,
            "value": value,
            "updated_by": user_id
        }).execute()
        return response.data[0]
    
    # ===========================================
    # LLM Cache
    # ===========================================
    
    async def get_llm_cache(self, prompt_hash: str) -> Optional[dict]:
        """Get cached LLM response"""
        response = self.client.table("llm_cache").select("*").eq("prompt_hash", prompt_hash).single().execute()
        return response.data
    
    async def set_llm_cache(self, cache_data: dict) -> dict:
        """Store LLM response in cache"""
        response = self.client.table("llm_cache").insert(cache_data).execute()
        return response.data[0]


# Global instance
db = DatabaseHelper()

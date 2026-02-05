"""
OpenManus Client
Browser automation integration for form filling and submission
"""
from typing import Dict, List, Optional, Any
import httpx
import structlog

from ..config import settings

logger = structlog.get_logger()


class OpenManusClient:
    """Client for OpenManus AI agent browser automation"""
    
    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None):
        self.api_url = api_url or settings.OPENMANUS_API_URL
        self.api_key = api_key or settings.OPENMANUS_API_KEY
        self.timeout = settings.OPENMANUS_TIMEOUT_SECONDS
        self.client = httpx.AsyncClient(timeout=self.timeout)
    
    async def __aenter__(self):
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        await self.close()
    
    async def close(self):
        await self.client.aclose()
    
    def _get_headers(self) -> Dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"
        return headers
    
    async def health_check(self) -> bool:
        """Check if OpenManus is available"""
        try:
            response = await self.client.get(f"{self.api_url}/health", headers=self._get_headers())
            return response.status_code == 200
        except Exception:
            return False
    
    async def execute_task(self, task: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute a browser automation task
        
        Task structure:
        {
            "goal": "Navigate to portal, fill form, upload files, submit",
            "portal_url": "https://sam.gov",
            "credentials": {"username": "...", "password": "..."},
            "form_data": {"field_name": "value", ...},
            "files": [{"name": "proposal.pdf", "path": "/path/to/file"}, ...]
        }
        """
        try:
            response = await self.client.post(
                f"{self.api_url}/agent/execute",
                json=task,
                headers=self._get_headers()
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            logger.error("OpenManus request failed", status=e.response.status_code)
            raise
        except Exception as e:
            logger.error("OpenManus error", error=str(e))
            raise
    
    async def submit_proposal(
        self,
        portal_url: str,
        credentials: Dict[str, str],
        form_data: Dict[str, Any],
        files: List[Dict[str, str]],
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """
        Submit a proposal to a government portal
        
        Returns:
        {
            "success": bool,
            "receipt_id": str or None,
            "confirmation_number": str or None,
            "screenshots": [str, ...],  # URLs to captured screenshots
            "steps_completed": ["login", "form_fill", "upload", "submit"],
            "error": str or None
        }
        """
        task = {
            "goal": f"Submit proposal to {portal_url}",
            "portal_url": portal_url,
            "credentials": credentials,
            "form_data": form_data,
            "files": files,
            "dry_run": dry_run,
            "capture_screenshots": True,
            "capture_receipt": True
        }
        
        result = await self.execute_task(task)
        
        return {
            "success": result.get("status") == "completed",
            "receipt_id": result.get("receipt_id"),
            "confirmation_number": result.get("confirmation_number"),
            "screenshots": result.get("screenshots", []),
            "steps_completed": result.get("steps", []),
            "error": result.get("error")
        }
    
    async def get_task_status(self, task_id: str) -> Dict[str, Any]:
        """Check status of a running task"""
        response = await self.client.get(
            f"{self.api_url}/agent/status/{task_id}",
            headers=self._get_headers()
        )
        response.raise_for_status()
        return response.json()

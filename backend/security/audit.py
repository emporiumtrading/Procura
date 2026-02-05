"""
Audit Log Signing
HMAC-SHA256 for cryptographic audit trail integrity
"""
import hmac
import hashlib
import json
from typing import Any
import structlog

from ..config import settings

logger = structlog.get_logger()


def _get_signing_key() -> bytes:
    """Get HMAC signing key"""
    key = settings.AUDIT_SIGNING_KEY
    if not key:
        raise ValueError("AUDIT_SIGNING_KEY not configured")
    return key.encode('utf-8') if isinstance(key, str) else key


def _canonicalize(data: dict) -> str:
    """Create canonical string representation for signing"""
    # Remove the hash field if present
    sign_data = {k: v for k, v in data.items() if k != "confirmation_hash"}
    # Sort keys for consistent ordering
    return json.dumps(sign_data, sort_keys=True, default=str)


def sign_audit_log(log_data: dict) -> str:
    """Generate HMAC-SHA256 signature for audit log"""
    key = _get_signing_key()
    canonical = _canonicalize(log_data)
    signature = hmac.new(key, canonical.encode('utf-8'), hashlib.sha256)
    return signature.hexdigest()


def verify_audit_log(log_data: dict, stored_hash: str) -> bool:
    """Verify audit log integrity by comparing signatures"""
    computed_hash = sign_audit_log(log_data)
    return hmac.compare_digest(computed_hash, stored_hash)

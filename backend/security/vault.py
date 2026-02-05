"""
Credential Vault
Fernet encryption for secure credential storage
"""
import json
import base64
from cryptography.fernet import Fernet
import structlog

from ..config import settings

logger = structlog.get_logger()

def get_fernet() -> Fernet:
    """Get Fernet instance with vault key"""
    key = settings.VAULT_ENCRYPTION_KEY
    if not key:
        raise ValueError("VAULT_ENCRYPTION_KEY not configured")
    
    # Ensure key is proper format
    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except Exception as e:
        logger.error("Invalid vault encryption key", error=str(e))
        raise ValueError("Invalid VAULT_ENCRYPTION_KEY format")


def encrypt_credentials(credentials: dict) -> str:
    """Encrypt credentials dictionary to string for storage"""
    fernet = get_fernet()
    json_bytes = json.dumps(credentials).encode('utf-8')
    encrypted = fernet.encrypt(json_bytes)
    return base64.urlsafe_b64encode(encrypted).decode('utf-8')


def decrypt_credentials(encrypted_str: str) -> dict:
    """Decrypt stored credentials back to dictionary"""
    fernet = get_fernet()
    encrypted_bytes = base64.urlsafe_b64decode(encrypted_str.encode('utf-8'))
    decrypted = fernet.decrypt(encrypted_bytes)
    return json.loads(decrypted.decode('utf-8'))


def generate_vault_key() -> str:
    """Generate a new Fernet key (for initial setup)"""
    return Fernet.generate_key().decode('utf-8')

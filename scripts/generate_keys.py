"""
Generate production security keys for Procura Ops.
Run once and store the output in your Render / Vercel environment variables.

Usage:
    cd procura-ops-command
    python scripts/generate_keys.py
"""
import secrets
from cryptography.fernet import Fernet

vault_key = Fernet.generate_key().decode()
audit_key = secrets.token_hex(32)

print("=" * 60)
print("Procura Ops — Production Security Keys")
print("=" * 60)
print()
print("Copy these to your Render environment variables:")
print()
print(f"VAULT_ENCRYPTION_KEY={vault_key}")
print(f"AUDIT_SIGNING_KEY={audit_key}")
print()
print("⚠  Keep these secret. Regenerating them will invalidate")
print("   all encrypted credentials stored in the database.")
print("=" * 60)

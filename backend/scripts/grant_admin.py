"""
Grant admin role to a user by email.
Uses SUPABASE_SERVICE_ROLE_KEY to update public.profiles.role.

Usage:
    cd backend && python scripts/grant_admin.py

Environment (optional):
    GRANT_ADMIN_EMAIL=you@example.com

Otherwise you will be prompted for the email.
"""
import os
import sys
from pathlib import Path

# Load .env from backend directory
backend_dir = Path(__file__).resolve().parent.parent
env_file = backend_dir / ".env"
if env_file.exists():
    from dotenv import load_dotenv
    load_dotenv(env_file)

from supabase import create_client, Client

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env")
    sys.exit(1)

# Reject placeholder keys
if "your-" in (key or "") or (key or "").strip() == "placeholder":
    print("Error: Use a real SUPABASE_SERVICE_ROLE_KEY in backend/.env (from Supabase project settings)")
    sys.exit(1)

supabase: Client = create_client(url, key)

email = os.environ.get("GRANT_ADMIN_EMAIL", "").strip()
if not email:
    email = input("Enter user email to grant admin: ").strip()
if not email or "@" not in email:
    print("Error: Valid email required")
    sys.exit(1)

try:
    # Find profile by email
    r = supabase.table("profiles").select("id, email, role").eq("email", email).execute()
    if not r.data or len(r.data) == 0:
        # User might exist in auth but not yet in profiles; try auth.admin.list_users
        try:
            users = supabase.auth.admin.list_users()
            ulist = users if isinstance(users, list) else getattr(users, "users", [])
            for u in ulist:
                if getattr(u, "email", None) == email:
                    uid = getattr(u, "id", None)
                    if uid:
                        supabase.table("profiles").upsert({
                            "id": uid,
                            "email": email,
                            "role": "admin",
                            "full_name": getattr(u, "user_metadata", {}).get("full_name"),
                        }, on_conflict="id").execute()
                        print(f"Created profile and set role=admin for {email}")
                        sys.exit(0)
        except Exception as e:
            pass
        print(f"No profile found for email: {email}. User may need to sign up once first.")
        sys.exit(1)

    row = r.data[0]
    user_id = row["id"]
    old_role = row.get("role", "viewer")

    if old_role == "admin":
        print(f"User {email} already has role 'admin'.")
        sys.exit(0)

    supabase.table("profiles").update({"role": "admin"}).eq("id", user_id).execute()
    print(f"Updated {email} role: {old_role} -> admin.")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)

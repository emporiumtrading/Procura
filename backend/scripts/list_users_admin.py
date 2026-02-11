
import os
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

if not url or not key:
    print("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    exit(1)

supabase: Client = create_client(url, key)

try:
    # List users (admin only)
    response = supabase.auth.admin.list_users()
    
    # Debug response type
    print(f"DEBUG: Response type: {type(response)}")
    # If response is a list, iterate it directly. If it has 'users', iterate that.
    if isinstance(response, list):
        users = response
    elif hasattr(response, 'users'):
        users = response.users
    else:
        print(f"DEBUG: Unknown response structure: {dir(response)}")
        users = []

    print("\n--- Registered Users ---")
    for user in users:
        print(f"ID: {user.id} | Email: {user.email} | Last Sign In: {user.last_sign_in_at}")
    print("------------------------\n")
except Exception as e:
    print(f"Error listing users: {e}")

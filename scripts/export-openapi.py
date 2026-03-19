#!/usr/bin/env python3
"""
Export OpenAPI spec from FastAPI app.
Usage: python scripts/export-openapi.py [--output openapi.json]
"""
import argparse
import json
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Minimal env for import (avoid production secret validation)
os.environ.setdefault("ENVIRONMENT", "development")
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "placeholder")
os.environ.setdefault("VAULT_ENCRYPTION_KEY", "placeholder")
os.environ.setdefault("AUDIT_SIGNING_KEY", "placeholder")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "-o", "--output",
        default="openapi.json",
        help="Output file path (default: openapi.json)",
    )
    args = parser.parse_args()

    from backend.main import app

    spec = app.openapi()
    with open(args.output, "w") as f:
        json.dump(spec, f, indent=2)

    print(f"OpenAPI spec written to {args.output}")


if __name__ == "__main__":
    main()

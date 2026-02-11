#!/bin/sh
# Pre-commit hook to prevent .env files and secrets from being committed
# Install: cp scripts/pre-commit-hook.sh .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit

RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Checking for secrets..."

# Check for .env files
if git diff --cached --name-only | grep -E '\.env$|\.env\.|^\.env'; then
  echo "${RED}🚨 ERROR: Attempting to commit .env file!${NC}"
  echo "Found these files:"
  git diff --cached --name-only | grep -E '\.env'
  echo ""
  echo "These files should NEVER be committed."
  echo "Add them to .gitignore and try again."
  exit 1
fi

# Check for common API key patterns
SECRETS_FOUND=0

# Supabase
if git diff --cached | grep -E 'SUPABASE.*KEY.*=.*[a-zA-Z0-9]{20,}'; then
  echo "${YELLOW}⚠️  WARNING: Potential Supabase key detected${NC}"
  SECRETS_FOUND=1
fi

# Google/Gemini
if git diff --cached | grep -E 'GOOGLE.*KEY.*=.*[a-zA-Z0-9]{20,}|GEMINI.*KEY.*=.*[a-zA-Z0-9]{20,}'; then
  echo "${YELLOW}⚠️  WARNING: Potential Google API key detected${NC}"
  SECRETS_FOUND=1
fi

# Generic API keys
if git diff --cached | grep -E 'API_KEY.*=.*[a-zA-Z0-9]{20,}'; then
  echo "${YELLOW}⚠️  WARNING: Potential API key detected${NC}"
  SECRETS_FOUND=1
fi

# Service role/secret keys
if git diff --cached | grep -E 'SERVICE_ROLE|SECRET.*KEY|PRIVATE.*KEY' | grep -v 'example\|sample\|template'; then
  echo "${YELLOW}⚠️  WARNING: Potential secret/service key detected${NC}"
  SECRETS_FOUND=1
fi

# Database passwords
if git diff --cached | grep -E 'PASSWORD.*=.*[^\s]{8,}|DB_PASS.*=' | grep -v 'example\|sample'; then
  echo "${YELLOW}⚠️  WARNING: Potential password detected${NC}"
  SECRETS_FOUND=1
fi

if [ $SECRETS_FOUND -eq 1 ]; then
  echo ""
  echo "${YELLOW}Found potential secrets in your commit!${NC}"
  echo ""
  echo "Review the warnings above carefully."
  echo "If these are real credentials:"
  echo "  1. Remove them from code"
  echo "  2. Store in .env files (gitignored)"
  echo "  3. Never commit real secrets"
  echo ""
  read -p "Are you SURE you want to commit? (yes/NO): " confirm
  
  if [ "$confirm" != "yes" ]; then
    echo "${RED}❌ Commit aborted.${NC}"
    exit 1
  fi
  
  echo "${YELLOW}⚠️  Proceeding with commit (you confirmed)${NC}"
fi

echo "✅ No obvious secrets detected. Safe to commit."
exit 0

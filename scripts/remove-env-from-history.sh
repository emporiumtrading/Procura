#!/bin/bash
# Security Incident Response - Automated .env Removal from Git History
# WARNING: This script rewrites git history. Make a backup first!

set -e  # Exit on error

echo "🚨 GIT HISTORY CLEANUP - REMOVE .ENV FILES"
echo "=========================================="
echo ""
echo "⚠️  WARNING: This will rewrite git history!"
echo "⚠️  All team members will need to reset their local copies."
echo ""
read -p "Have you made a backup? (y/N): " backup_confirm
if [ "$backup_confirm" != "y" ]; then
  echo "❌ Aborted. Please backup your repo first:"
  echo "   git clone --mirror <your-repo-url> backup.git"
  exit 1
fi

echo ""
read -p "Have you rotated ALL API keys? (y/N): " keys_confirm
if [ "$keys_confirm" != "y" ]; then
  echo "❌ Aborted. Rotate keys FIRST before cleaning history."
  echo "   See: docs/security/API-KEY-ROTATION-GUIDE.md"
  exit 1
fi

echo ""
echo "✅ Proceeding with cleanup..."
echo ""

# Method 1: Try git-filter-repo (fastest, recommended)
if command -v git-filter-repo &> /dev/null; then
  echo "📦 Using git-filter-repo (recommended method)"
  
  git-filter-repo --invert-paths \
    --path backend/.env \
    --path .env.local \
    --path .env \
    --path '**/.env' \
    --force
  
  echo "✅ History cleaned with git-filter-repo"
  echo ""
  echo "📌 Next steps:"
  echo "1. Re-add remote: git remote add origin <your-repo-url>"
  echo "2. Force push: git push --force --all"
  echo "3. Force push tags: git push --force --tags"
  
# Method 2: Fallback to filter-branch
else
  echo "📦 git-filter-repo not found. Using filter-branch (slower)"
  echo "   Install git-filter-repo for faster cleanup:"
  echo "   pip install git-filter-repo"
  echo ""
  
  # Remove backend/.env
  echo "🧹 Removing backend/.env from history..."
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch backend/.env" \
    --prune-empty --tag-name-filter cat -- --all
  
  # Remove .env.local
  echo "🧹 Removing .env.local from history..."
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env.local" \
    --prune-empty --tag-name-filter cat -- --all
  
  # Remove .env
  echo "🧹 Removing .env from history..."
  git filter-branch --force --index-filter \
    "git rm --cached --ignore-unmatch .env" \
    --prune-empty --tag-name-filter cat -- --all
  
  # Clean up
  echo "🗑️  Cleaning up refs..."
  git reflog expire --expire=now --all
  git gc --prune=now --aggressive
  
  echo "✅ History cleaned with filter-branch"
  echo ""
  echo "📌 Next step: git push --force --all"
fi

echo ""
echo "✅ DONE! Verify with:"
echo "   git log --all --full-history -- '*.env'"
echo "   (should show no results)"
echo ""
echo "⚠️  Don't forget to notify team members!"

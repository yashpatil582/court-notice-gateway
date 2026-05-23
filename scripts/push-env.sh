#!/usr/bin/env bash
# Push every key from .env.local up to Vercel production.
# Safe to re-run — existing keys are skipped silently.
set -e

while IFS='=' read -r key value; do
  # Skip blanks and comments
  [[ -z "$key" || "$key" =~ ^# ]] && continue
  # Strip surrounding quotes if present
  value="${value%\"}"; value="${value#\"}"
  echo "→ $key"
  if printf '%s' "$value" | vercel env add "$key" production 2>&1 | tail -1; then
    :
  fi
done < .env.local

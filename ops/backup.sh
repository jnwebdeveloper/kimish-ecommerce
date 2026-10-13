#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
mkdir -p backups
file="backups/kimish-$(date -u +%Y%m%dT%H%M%SZ).dump"
pg_dump --format=custom --no-owner --no-acl --file="$file" "$DATABASE_URL"
echo "Backup created: $file (store securely off-host)"

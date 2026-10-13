#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${1:?Usage: restore.sh /path/to/backup.dump}"
echo 'WARNING: restore can overwrite target database objects. Confirm the target database before proceeding.'
: "${CONFIRM_RESTORE:?Set CONFIRM_RESTORE=yes after verifying the target}"
[[ "$CONFIRM_RESTORE" == yes ]] || exit 1
pg_restore --clean --if-exists --no-owner --no-acl --dbname="$DATABASE_URL" "$1"

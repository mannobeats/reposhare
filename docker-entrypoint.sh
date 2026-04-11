#!/bin/sh
set -eu

mkdir -p /data
chown nextjs:nodejs /data 2>/dev/null || true

for path in \
  /data/reposhare.db \
  /data/reposhare.db-journal \
  /data/reposhare.db-shm \
  /data/reposhare.db-wal
do
  if [ -e "$path" ]; then
    chown nextjs:nodejs "$path"
  fi
done

su-exec nextjs node scripts/apply-migrations.mjs

exec su-exec nextjs "$@"

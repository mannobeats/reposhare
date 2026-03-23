#!/bin/sh
set -eu

mkdir -p /data
chown -R nextjs:nodejs /data

su-exec nextjs node scripts/apply-migrations.mjs

exec su-exec nextjs "$@"

#!/bin/sh
set -eu

mkdir -p /data

node scripts/apply-migrations.mjs

exec "$@"

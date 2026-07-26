#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm ci --include=dev
npm run build
echo "Chloris V6.13 admin build completed."

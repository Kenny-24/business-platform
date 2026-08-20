#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
npm ci --include=dev
npm run build
echo "Chloris admin build completed."

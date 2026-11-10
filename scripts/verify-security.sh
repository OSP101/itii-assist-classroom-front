#!/usr/bin/env bash
# Run in a development/CI checkout with Node compatible with Next 16 and npm.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."
npm ci
npm audit
npm run test:security
npm run typecheck
npm run build

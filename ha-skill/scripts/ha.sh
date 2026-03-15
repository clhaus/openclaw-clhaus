#!/usr/bin/env bash
set -euo pipefail
export HA_URL="${HA_URL:-http://localhost:8123}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "${SCRIPT_DIR}/src/ha-client.mjs" "$@"

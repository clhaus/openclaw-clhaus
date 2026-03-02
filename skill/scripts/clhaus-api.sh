#!/usr/bin/env bash
# cl.haus API helper — source this file or run directly
# Usage: clhaus <command> [args...]
#
# Env vars:
#   CLHAUS_API_KEY  — API key (required)
#   CLHAUS_API_URL  — base URL (default: https://cl.haus)
#   CLHAUS_HOME_ID  — home UUID (required for most commands)

set -euo pipefail

: "${CLHAUS_API_URL:=https://cl.haus}"

_clhaus_check() {
  if [[ -z "${CLHAUS_API_KEY:-}" ]]; then
    echo '{"error": "CLHAUS_API_KEY not set"}' >&2; return 1
  fi
  if [[ -z "${CLHAUS_HOME_ID:-}" ]]; then
    echo '{"error": "CLHAUS_HOME_ID not set"}' >&2; return 1
  fi
}

_clhaus_curl() {
  curl -sS -H "Authorization: Bearer ${CLHAUS_API_KEY}" "$@"
}

clhaus() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    upload-photo)
      _clhaus_check || return 1
      local file="${1:?Usage: clhaus upload-photo <file> [caption]}"
      local caption="${2:-}"
      local args=(-X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/photos" -F "file=@${file}")
      [[ -n "$caption" ]] && args+=(-F "caption=${caption}")
      _clhaus_curl "${args[@]}"
      ;;
    list-photos)
      _clhaus_check || return 1
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/photos"
      ;;
    add-room)
      _clhaus_check || return 1
      local name="${1:?Usage: clhaus add-room <name> [floor]}"
      local floor="${2:-}"
      local body
      body=$(jq -n --arg name "$name" --arg floor "$floor" \
        '{name: $name} + (if ($floor | length) > 0 then {floor: $floor} else {} end)')
      _clhaus_curl -X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/rooms" \
        -H "Content-Type: application/json" -d "$body"
      ;;
    list-rooms)
      _clhaus_check || return 1
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/rooms"
      ;;
    add-system)
      _clhaus_check || return 1
      local name="${1:?Usage: clhaus add-system <name> [type] [room-id]}"
      local type="${2:-}"
      local roomId="${3:-}"
      local body
      body=$(jq -n --arg name "$name" --arg type "$type" --arg roomId "$roomId" \
        '{name: $name}
        + (if ($type | length) > 0 then {type: $type} else {} end)
        + (if ($roomId | length) > 0 then {roomId: $roomId} else {} end)')
      _clhaus_curl -X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems" \
        -H "Content-Type: application/json" -d "$body"
      ;;
    get-system)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus get-system <id>}"
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems/${id}"
      ;;
    update-system)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus update-system <id> <json>}"
      local json="${2:?Usage: clhaus update-system <id> <json>}"
      _clhaus_curl -X PUT "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems/${id}" \
        -H "Content-Type: application/json" -d "$json"
      ;;
    delete-system)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus delete-system <id>}"
      _clhaus_curl -X DELETE "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems/${id}"
      ;;
    delete-room)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus delete-room <roomId>}"
      _clhaus_curl -X DELETE "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/rooms/${id}"
      ;;
    get-room)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus get-room <roomId>}"
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/rooms/${id}"
      ;;
    list-systems)
      _clhaus_check || return 1
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems"
      ;;
    whoami)
      [[ -z "${CLHAUS_API_KEY:-}" ]] && { echo '{"error": "CLHAUS_API_KEY not set"}' >&2; return 1; }
      _clhaus_curl "${CLHAUS_API_URL}/api/whoami"
      ;;
    help|*)
      cat <<EOF
cl.haus API helper

Commands:
  upload-photo <file> [caption]       Upload a photo
  list-photos                         List photos for home
  add-room <name> [floor]             Create a room
  list-rooms                          List rooms
  get-room <roomId>                   Get a room
  delete-room <roomId>               Delete a room
  add-system <name> [type] [room-id]  Create a system
  get-system <id>                     Get a system
  update-system <id> <json>           Update a system
  delete-system <id>                  Delete a system
  list-systems                        List systems
  whoami                              Check authentication

Env: CLHAUS_API_KEY, CLHAUS_API_URL (default: https://cl.haus), CLHAUS_HOME_ID
EOF
      ;;
  esac
}

# Allow direct execution: ./clhaus-api.sh <command> [args...]
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  clhaus "$@"
fi

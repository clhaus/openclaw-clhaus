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
    add-device)
      _clhaus_check || return 1
      local name="${1:?Usage: clhaus add-device <name> <protocol> [--dsk <dsk>] [--room <roomId>] [--system <systemId>] [--manufacturer <mfg>] [--model <model>]}"
      local protocol="${2:?Usage: clhaus add-device <name> <protocol> ...}"
      shift 2
      local dsk="" roomId="" systemId="" manufacturer="" model=""
      while [[ $# -gt 0 ]]; do
        case "$1" in
          --dsk) dsk="$2"; shift 2 ;;
          --room) roomId="$2"; shift 2 ;;
          --system) systemId="$2"; shift 2 ;;
          --manufacturer) manufacturer="$2"; shift 2 ;;
          --model) model="$2"; shift 2 ;;
          *) echo "{\"error\": \"Unknown option: $1\"}" >&2; return 1 ;;
        esac
      done
      local body
      body=$(jq -n \
        --arg name "$name" \
        --arg protocol "$protocol" \
        --arg dsk "$dsk" \
        --arg roomId "$roomId" \
        --arg systemId "$systemId" \
        --arg manufacturer "$manufacturer" \
        --arg model "$model" \
        '{name: $name, protocol: $protocol}
        + (if ($dsk | length) > 0 then {dsk: $dsk} else {} end)
        + (if ($roomId | length) > 0 then {roomId: $roomId} else {} end)
        + (if ($systemId | length) > 0 then {systemId: $systemId} else {} end)
        + (if ($manufacturer | length) > 0 then {manufacturer: $manufacturer} else {} end)
        + (if ($model | length) > 0 then {model: $model} else {} end)')
      _clhaus_curl -X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/devices" \
        -H "Content-Type: application/json" -d "$body"
      ;;
    list-devices)
      _clhaus_check || return 1
      local status_filter="${1:-}"
      local url="${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/devices"
      [[ -n "$status_filter" ]] && url="${url}?status=${status_filter}"
      _clhaus_curl "$url"
      ;;
    get-device)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus get-device <deviceId>}"
      _clhaus_curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/devices/${id}"
      ;;
    update-device)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus update-device <deviceId> <json>}"
      local json="${2:?Usage: clhaus update-device <deviceId> <json>}"
      _clhaus_curl -X PUT "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/devices/${id}" \
        -H "Content-Type: application/json" -d "$json"
      ;;
    delete-device)
      _clhaus_check || return 1
      local id="${1:?Usage: clhaus delete-device <deviceId>}"
      _clhaus_curl -X DELETE "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/devices/${id}"
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
  add-device <name> <protocol> [opts] Create a device (--dsk, --room, --system, --manufacturer, --model)
  list-devices [status]               List devices (optional status filter)
  get-device <deviceId>               Get a device
  update-device <deviceId> <json>     Update a device
  delete-device <deviceId>            Delete a device
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

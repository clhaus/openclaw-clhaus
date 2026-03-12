#!/usr/bin/env bash
# Home Assistant API helper — source this file or run directly
# Usage: ha <command> [args...]
#
# Env vars:
#   HA_TOKEN  — long-lived access token (required)
#   HA_URL    — base URL (default: http://localhost:8123)
#
# Token file fallback: /home/openclaw/.config/ha/token

set -euo pipefail

: "${HA_URL:=http://localhost:8123}"

# Load token from file if env var not set
if [[ -z "${HA_TOKEN:-}" ]]; then
  TOKEN_FILE="/home/openclaw/.config/ha/token"
  if [[ -f "$TOKEN_FILE" ]]; then
    HA_TOKEN=$(cat "$TOKEN_FILE")
  fi
fi

_ha_check() {
  if [[ -z "${HA_TOKEN:-}" ]]; then
    echo '{"error": "HA_TOKEN not set. Run configure-ha.sh --token <token> or export HA_TOKEN."}' >&2
    return 1
  fi
}

_ha_curl() {
  curl -sS -H "Authorization: Bearer ${HA_TOKEN}" -H "Content-Type: application/json" "$@"
}

ha() {
  local cmd="${1:-help}"
  shift || true

  case "$cmd" in
    list-entities)
      _ha_check || return 1
      local domain="${1:-}"
      local resp
      resp=$(_ha_curl "${HA_URL}/api/states")
      if [[ -n "$domain" ]]; then
        echo "$resp" | jq -r --arg d "$domain" '
          [.[] | select(.entity_id | startswith($d + "."))]
          | sort_by(.entity_id)
          | .[]
          | [.entity_id, .state, (.attributes.friendly_name // "")] | @tsv' \
          | column -t -s $'\t' 2>/dev/null || echo "$resp" | jq -r --arg d "$domain" '
          [.[] | select(.entity_id | startswith($d + "."))]
          | sort_by(.entity_id)
          | .[]
          | "\(.entity_id)\t\(.state)\t\(.attributes.friendly_name // "")"'
      else
        echo "$resp" | jq -r '
          sort_by(.entity_id)
          | .[]
          | [.entity_id, .state, (.attributes.friendly_name // "")] | @tsv' \
          | column -t -s $'\t' 2>/dev/null || echo "$resp" | jq -r '
          sort_by(.entity_id)
          | .[]
          | "\(.entity_id)\t\(.state)\t\(.attributes.friendly_name // "")"'
      fi
      ;;

    get-state)
      _ha_check || return 1
      local entity="${1:?Usage: ha get-state <entity_id>}"
      _ha_curl "${HA_URL}/api/states/${entity}" | jq .
      ;;

    call-service)
      _ha_check || return 1
      local domain="${1:?Usage: ha call-service <domain> <service> <entity_id> [json]}"
      local service="${2:?Usage: ha call-service <domain> <service> <entity_id> [json]}"
      local entity="${3:?Usage: ha call-service <domain> <service> <entity_id> [json]}"
      local extra="${4:-}"
      local body
      if [[ -n "$extra" ]]; then
        body=$(echo "$extra" | jq --arg eid "$entity" '. + {entity_id: $eid}')
      else
        body=$(jq -n --arg eid "$entity" '{entity_id: $eid}')
      fi
      _ha_curl -X POST "${HA_URL}/api/services/${domain}/${service}" -d "$body" | jq .
      ;;

    list-areas)
      _ha_check || return 1
      _ha_curl "${HA_URL}/api/config" | jq '.area_registry // empty'
      ;;

    states)
      _ha_check || return 1
      _ha_curl "${HA_URL}/api/states" | jq .
      ;;

    help|*)
      cat <<EOF
Home Assistant API helper

Commands:
  list-entities [domain]                          List entities (optionally filter by domain)
  get-state <entity_id>                           Get state of a single entity
  call-service <domain> <service> <entity_id> [json]  Call a service on an entity
  list-areas                                      List configured areas
  states                                          Full state dump (JSON)
  help                                            Show this help

Domains: light, switch, sensor, binary_sensor, climate, cover, media_player, automation, scene, lock

Env: HA_TOKEN (required), HA_URL (default: http://localhost:8123)
EOF
      ;;
  esac
}

# Allow direct execution: ./ha-api.sh <command> [args...]
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  ha "$@"
fi

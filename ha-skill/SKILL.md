---
name: ha
description: "Control Home Assistant smart home devices — turn lights on/off, check sensor states, call services, and list entities. Use when the user asks to control devices, check temperatures, manage automations, or interact with their smart home."
---

# Home Assistant Skill

Control the local Home Assistant instance via its REST API.

## Authentication

All API requests require a long-lived access token:
- `HA_TOKEN` — long-lived access token (set by install-ha.sh or configure-ha.sh)
- `HA_URL` — base URL (default: `http://localhost:8123`)

Token file fallback: `/home/openclaw/.config/ha/token`

## How to Run Commands

Execute the helper script using its full path relative to this skill directory:

```bash
bash scripts/ha-api.sh <command> [args...]
```

**Important:** Always use `bash scripts/ha-api.sh`, not just `ha`. The script path is relative to this skill's directory.

### List entities
```bash
bash scripts/ha-api.sh list-entities              # all entities
bash scripts/ha-api.sh list-entities light        # only lights
bash scripts/ha-api.sh list-entities sensor       # only sensors
bash scripts/ha-api.sh list-entities switch       # only switches
```

### Get entity state
```bash
bash scripts/ha-api.sh get-state light.living_room
bash scripts/ha-api.sh get-state sensor.temperature
bash scripts/ha-api.sh get-state switch.fan
```

### Call a service
```bash
bash scripts/ha-api.sh call-service light turn_on light.living_room
bash scripts/ha-api.sh call-service light turn_off light.living_room
bash scripts/ha-api.sh call-service light turn_on light.living_room '{"brightness": 128, "color_name": "blue"}'
bash scripts/ha-api.sh call-service switch toggle switch.fan
bash scripts/ha-api.sh call-service climate set_temperature climate.thermostat '{"temperature": 72}'
bash scripts/ha-api.sh call-service automation trigger automation.morning_routine
```

### List areas
```bash
bash scripts/ha-api.sh list-areas
```

### Full state dump
```bash
bash scripts/ha-api.sh states
```

## Common Entity Domains

| Domain | Examples |
|--------|----------|
| `light` | light.living_room, light.kitchen |
| `switch` | switch.fan, switch.outlet |
| `sensor` | sensor.temperature, sensor.humidity |
| `binary_sensor` | binary_sensor.door, binary_sensor.motion |
| `climate` | climate.thermostat |
| `cover` | cover.garage_door, cover.blinds |
| `media_player` | media_player.tv, media_player.speaker |
| `automation` | automation.morning_routine |
| `scene` | scene.movie_night |
| `lock` | lock.front_door |

## REST API Reference

These are the underlying HA REST API endpoints:

### States
- `GET /api/states` — all entity states
- `GET /api/states/<entity_id>` — single entity state

### Services
- `GET /api/services` — list available services
- `POST /api/services/<domain>/<service>` — call a service
  - Body: `{"entity_id": "light.living_room", ...extra_data}`

### Config
- `GET /api/config` — HA config (areas, location, units, etc.)

### Health
- `GET /api/` — API status check (returns `{"message": "API running."}`)

## Example Workflows

### Turn on a light
```bash
bash scripts/ha-api.sh call-service light turn_on light.living_room
```

### Set thermostat
```bash
bash scripts/ha-api.sh call-service climate set_temperature climate.thermostat '{"temperature": 72}'
```

### Check all sensors
```bash
bash scripts/ha-api.sh list-entities sensor
```

### Find devices in a room
```bash
bash scripts/ha-api.sh list-entities | grep kitchen
```

---
name: ha
description: "Control Home Assistant smart home devices and manage Z-Wave network. Use for device control (lights, switches, sensors), Z-Wave device provisioning (Smart Start QR codes), and checking device/network status. IMPORTANT: When adding a new device, FIRST create a device record in cl.haus (using the clhaus skill), THEN use this skill for HA provisioning/pairing."
---

# Home Assistant Skill

Control the local Home Assistant instance. Supports device control (REST API) and Z-Wave device management (WebSocket API).

## Device Onboarding Workflow

**When adding a new smart device, follow this order:**

1. **Create the device record in cl.haus FIRST** (using the clhaus skill):
   ```bash
   clhaus add-device "Kitchen Switch" zwave --manufacturer Aeotec --model "Smart Switch 7" --room <roomId>
   ```
   This creates a `pending` device record in the home inventory.

2. **Then provision/pair via this HA skill** (Smart Start QR or manual inclusion).

3. **Update the cl.haus record** after pairing succeeds:
   ```bash
   clhaus update-device <deviceId> '{"status":"paired","nodeId":15,"haEntityIds":["switch.kitchen_1"]}'
   ```

The cl.haus device record is the system of record. HA is the execution layer. Always keep both in sync.

## Authentication

All API requests require a long-lived access token. The parent clhaus installer sets
this automatically; to configure manually, either:

1. Export the env var: `export HA_TOKEN="<your-token>"`
2. Write the token to a file: `${XDG_CONFIG_HOME:-$HOME/.config}/ha/token`

The script checks `HA_TOKEN` first, then falls back to the token file.

Optionally set the base URL (default: `http://localhost:8123`):
- `export HA_URL="http://<your-ha-host>:8123"`

## How to Run Commands

Execute the helper script using its full path relative to this skill directory:

```bash
bash scripts/ha.sh <command> [args...]
```

**Important:** Always use `bash scripts/ha.sh`, not just `ha`. The script path is relative to this skill's directory.

## Device Control (REST)

### List entities
```bash
bash scripts/ha.sh list-entities              # all entities
bash scripts/ha.sh list-entities light        # only lights
bash scripts/ha.sh list-entities sensor       # only sensors
bash scripts/ha.sh list-entities switch       # only switches
```

### Get entity state
```bash
bash scripts/ha.sh get-state light.living_room
bash scripts/ha.sh get-state sensor.temperature
bash scripts/ha.sh get-state switch.fan
```

### Call a service
```bash
bash scripts/ha.sh call-service light turn_on light.living_room
bash scripts/ha.sh call-service light turn_off light.living_room
bash scripts/ha.sh call-service light turn_on light.living_room '{"brightness": 128, "color_name": "blue"}'
bash scripts/ha.sh call-service switch toggle switch.fan
bash scripts/ha.sh call-service climate set_temperature climate.thermostat '{"temperature": 72}'
```

### List areas
```bash
bash scripts/ha.sh list-areas
```

### Full state dump
```bash
bash scripts/ha.sh states
```

## Z-Wave Device Management (WebSocket)

### List Z-Wave nodes
```bash
bash scripts/ha.sh zwave-nodes
```
Returns all Z-Wave nodes with status (alive/asleep/dead), node ID, name, manufacturer, model.

### Smart Start provisioning (QR code path — preferred)
```bash
# All-in-one: decode QR from image, parse, and provision
bash scripts/ha.sh zwave-scan-qr /path/to/qr-photo.jpg

# Or step by step:
bash scripts/ha.sh zwave-parse-qr "9001327331313879..."    # parse raw QR string
bash scripts/ha.sh zwave-provision '<qr_info_json>'         # add to Smart Start list
```
After provisioning, the device auto-pairs when powered on. Poll `zwave-nodes` to detect when it appears.

### Unprovision (remove from Smart Start list)
```bash
bash scripts/ha.sh zwave-unprovision "12345-67890-12345-67890-12345-67890-12345-67890"
```

### List provisioned devices (Smart Start queue)
```bash
bash scripts/ha.sh zwave-list-provisioned
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
| `lock` | lock.front_door |

## Example Workflows

### Add a new device (full flow)
1. User sends QR code photo
2. Create cl.haus record: `clhaus add-device "New Switch" zwave`
3. Update status: `clhaus update-device <id> '{"status":"provisioned"}'`
4. Provision in HA: `bash scripts/ha.sh zwave-scan-qr /path/to/photo.jpg`
5. Wait for device to pair (poll `bash scripts/ha.sh zwave-nodes`)
6. Update cl.haus: `clhaus update-device <id> '{"status":"paired","nodeId":N,"haEntityIds":[...]}'`

### Turn on a light
```bash
bash scripts/ha.sh call-service light turn_on light.living_room
```

### Check all sensors
```bash
bash scripts/ha.sh list-entities sensor
```

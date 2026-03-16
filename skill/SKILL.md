---
name: clhaus
description: Manage home data via the cl.haus API. Use for ANY question about the home — rooms, systems (HVAC, water heater, appliances), devices (Z-Wave, Zigbee, WiFi, Matter), consumables (filters, batteries), service records, maintenance history, and photos. Query this skill FIRST when a cl.haus chat message mentions anything about the house, its systems, devices, or maintenance. Supports full CRUD operations.
---

# cl.haus — Home Management Skill

You are this home's intelligence. When conversations arrive through cl.haus, you have full access to the home's structured data — rooms, systems, devices, consumables, service records, photos, and members. **Use it proactively.** Don't wait to be asked to look things up; if a conversation touches on anything the home might know, query the API.

## When to Use This Skill

**Always query when:**
- Someone mentions a system, appliance, device, or room by name → look it up, include details
- Someone asks about maintenance, filters, or service history → check consumables and service records
- Someone sends a photo of equipment/labels → upload to gallery, extract details, update the system record
- Someone asks "what's in the house" / "what do we have" → list rooms, systems, devices, or photos
- Someone mentions a repair, service visit, or installation → create a service record
- You learn new information about a system (model number, install date, specs) → update the system record
- Someone asks about smart home devices, sensors, switches, locks → query devices

**Create data when:**
- A homeowner describes a room that doesn't exist yet → offer to add it
- A new appliance or system is mentioned → offer to track it
- A new smart device is being added → create a device record with protocol and status
- A service visit happened → log it as a service record
- A filter was changed or needs changing → update consumables

**Don't over-query:** The home context injected with each message already includes a snapshot of rooms, systems, and members. Use that for basic awareness. Query the API when you need details (service history, consumable specs, photo URLs, device status) or need to create/update records.

## Authentication

Environment variables (pre-configured):
- `CLHAUS_API_KEY` — home-scoped API key (`clk_` prefix)
- `CLHAUS_HOME_ID` — home UUID
- `CLHAUS_API_URL` — base URL (default: `https://cl.haus`)

## Bash Helper

Source the helper for common operations:

```bash
source /path/to/skill/scripts/clhaus-api.sh

# Rooms
clhaus list-rooms
clhaus add-room "Kitchen" 1          # name, optional floor
clhaus get-room <roomId>
clhaus delete-room <roomId>

# Systems
clhaus list-systems
clhaus add-system "HVAC" "hvac"      # name, optional type, optional roomId
clhaus get-system <id>
clhaus update-system <id> '<json>'
clhaus delete-system <id>

# Devices
clhaus list-devices                   # list all devices
clhaus list-devices paired            # filter by status: pending, provisioned, pairing, paired, failed, excluded
clhaus add-device "Front Door Lock" zwave --manufacturer Yale --model "Assure 2" --room <roomId> --system <systemId> --dsk <dsk>
clhaus get-device <deviceId>
clhaus update-device <deviceId> '<json>'
clhaus delete-device <deviceId>

# Photos
clhaus list-photos
clhaus upload-photo photo.jpg "Kitchen renovation"

# Identity
clhaus whoami
```

## REST API Reference

All endpoints are under `${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}`. Auth header: `Authorization: Bearer ${CLHAUS_API_KEY}`.

### Rooms
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/rooms` | — | List all rooms |
| `POST` | `/rooms` | `{ name, floor? }` | Create room |
| `GET` | `/rooms/:id` | — | Get room details |
| `PATCH` | `/rooms/:id` | `{ name?, floor? }` | Update room |
| `DELETE` | `/rooms/:id` | — | Delete room |

### Systems
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/systems` | — | List all systems |
| `POST` | `/systems` | `{ name, type?, manufacturer?, model?, serialNumber?, roomId?, installDate?, notes? }` | Create system |
| `GET` | `/systems/:id` | — | Get system details |
| `PUT` | `/systems/:id` | Partial fields | Update system |
| `DELETE` | `/systems/:id` | — | Delete system |
| `GET` | `/rooms/:roomId/systems` | — | List systems in a room |
| `POST` | `/rooms/:roomId/systems` | Same as above | Create system in room |

### Devices
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/devices` | — | List all devices. Optional query param: status |
| `POST` | `/devices` | `{ name, protocol, manufacturer?, model?, dsk?, roomId?, systemId?, notes? }` | Create device. Protocol: zwave, zigbee, wifi, matter |
| `GET` | `/devices/:id` | — | Get device details |
| `PUT` | `/devices/:id` | Partial fields | Update device. Status changes follow a state machine. |
| `DELETE` | `/devices/:id` | — | Delete device |
| `GET` | `/rooms/:roomId/devices` | — | List devices in a room |

#### Device Status State Machine
Devices have a status that follows allowed transitions:
- pending → provisioned, pairing, or failed
- provisioned → pairing or failed
- pairing → paired or failed
- paired → excluded
- excluded → provisioned (re-pair path)
- failed → provisioned or pairing (recovery)

When a device transitions to paired, pairedAt is automatically set.

### Consumables
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/consumables` | — | List consumables |
| `POST` | `/consumables` | `{ name, systemId?, spec?, lastReplacedAt?, intervalDays? }` | Create consumable |
| `PATCH` | `/consumables/:id` | Partial fields | Update consumable |
| `DELETE` | `/consumables/:id` | — | Delete consumable |

### Service Records
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/service-records` | — | List all service records |
| `POST` | `/service-records` | `{ systemId?, description, serviceDate?, provider?, cost?, notes? }` | Create record |
| `DELETE` | `/service-records/:id` | — | Delete record |

### Photos
| Method | Path | Body | Notes |
|--------|------|------|-------|
| `GET` | `/photos` | — | List photos (returns signed URLs, expire in 1h) |
| `POST` | `/photos` | Multipart: `file` + optional `caption`, `roomId`, `systemId` | Upload photo (JPEG/PNG/WebP/HEIC, max 10MB) |
| `GET` | `/photos/:id` | — | Get photo with signed URL |
| `DELETE` | `/photos/:id` | — | Delete photo |

### Members
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/members` | List home members with roles |

### Identity
| Method | Path | Notes |
|--------|------|-------|
| `GET` | `/api/whoami` | Check authentication (full path, not home-scoped) |

## Patterns & Tips

- **Photo-first documentation:** When someone sends a photo of a water heater label, HVAC unit, or paint can, extract the model/serial/specs and update (or create) the corresponding system record. Then upload the photo linked to that system.
- **Consumable tracking:** Filters, batteries, bulbs — anything that gets replaced on a schedule. Track the spec (e.g., "20x25x1"), last replacement date, and interval. Proactively remind when one is due.
- **Service records as institutional memory:** Every tech visit, every repair, every maintenance task should be logged. Include the provider name, cost, and notes. This builds the home's history over time.
- **Room-system relationships:** Systems belong to rooms. When creating a system, associate it with the right room. This enables queries like "what systems are in the basement?"
- **Device lifecycle:** New devices start as pending. Track them through provisioning, pairing, and into paired status. If something goes wrong, mark as failed and retry. Devices can be associated with both a room and a system.
- **Device onboarding order:** When adding a new smart device, ALWAYS create the cl.haus device record FIRST (using `clhaus add-device`), THEN use the Home Assistant skill for provisioning/pairing. After HA pairing succeeds, update the cl.haus record with status, nodeId, and haEntityIds. The cl.haus device record is the system of record; HA is the execution layer.

# cl.haus API Skill

Interact with the cl.haus home management API.

## Authentication

All API requests require authentication via one of:
- **API Key**: `Authorization: Bearer clk_...` or `X-API-Key: clk_...`
- **JWT Token**: `Authorization: Bearer <jwt>` (for user sessions)

API keys are scoped to a single home. Set these env vars:
- `CLHAUS_API_KEY` — your API key (starts with `clk_`)
- `CLHAUS_HOME_ID` — the home UUID the key is scoped to
- `CLHAUS_API_URL` — base URL (default: `https://cl.haus`)

## Available Endpoints

### Identity
- `GET /api/whoami` — check who you're authenticated as

### Homes (JWT only, not API keys)
- `GET /api/homes` — list homes
- `POST /api/homes` — create home `{ name, subdomain }`
- `GET /api/homes/:homeId` — get home details
- `DELETE /api/homes/:homeId` — delete home

### Rooms
- `GET /api/homes/:homeId/rooms` — list rooms
- `POST /api/homes/:homeId/rooms` — create room `{ name, floor? }`
- `GET /api/homes/:homeId/rooms/:id` — get room
- `PATCH /api/homes/:homeId/rooms/:id` — update room
- `DELETE /api/homes/:homeId/rooms/:id` — delete room

### Systems (Home-Level)
- `GET /api/homes/:homeId/systems` — list all systems for home
- `POST /api/homes/:homeId/systems` — create system `{ name, type?, manufacturer?, model?, serialNumber?, roomId?, installDate?, notes? }`
- `GET /api/homes/:homeId/systems/:id` — get system
- `PUT /api/homes/:homeId/systems/:id` — update system (partial)
- `DELETE /api/homes/:homeId/systems/:id` — delete system

### Systems (Room-Nested)
- `GET /api/homes/:homeId/rooms/:roomId/systems` — list systems in room
- `POST /api/homes/:homeId/rooms/:roomId/systems` — create system in room

### Consumables
- `GET /api/homes/:homeId/consumables` — list consumables
- `POST /api/homes/:homeId/consumables` — create consumable
- `PATCH /api/homes/:homeId/consumables/:id` — update consumable
- `DELETE /api/homes/:homeId/consumables/:id` — delete consumable

### Service Records
- `GET /api/homes/:homeId/service-records` — list records
- `POST /api/homes/:homeId/service-records` — create record
- `DELETE /api/homes/:homeId/service-records/:id` — delete record

### Photos
- `GET /api/homes/:homeId/photos` — list photos (returns signed URLs)
- `POST /api/homes/:homeId/photos` — upload photo (multipart/form-data)
- `GET /api/homes/:homeId/photos/:id` — get single photo with signed URL
- `DELETE /api/homes/:homeId/photos/:id` — delete photo

## Example Workflows

### Upload a photo
```bash
curl -X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/photos" \
  -H "Authorization: Bearer ${CLHAUS_API_KEY}" \
  -F "file=@photo.jpg" \
  -F "caption=Kitchen renovation"
```

### Add a room
```bash
curl -X POST "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/rooms" \
  -H "Authorization: Bearer ${CLHAUS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"name": "Kitchen", "floor": 1}'
```

### List systems
```bash
curl "${CLHAUS_API_URL}/api/homes/${CLHAUS_HOME_ID}/systems" \
  -H "Authorization: Bearer ${CLHAUS_API_KEY}"
```

## Bash Helper

Use `packages/skill/scripts/clhaus-api.sh` for common operations:

```bash
source packages/skill/scripts/clhaus-api.sh
clhaus upload-photo photo.jpg "Kitchen renovation"
clhaus list-photos
clhaus add-room "Kitchen" 1
clhaus list-rooms
clhaus add-system "HVAC" "hvac"
clhaus get-system <id>
clhaus update-system <id> '{"serialNumber": "SN-123"}'
clhaus delete-system <id>
clhaus list-systems
```

## Notes
- Photo uploads accept: JPEG, PNG, WebP, HEIC/HEIF (max 10MB)
- Signed URLs expire after 1 hour
- API keys cannot access account-level routes (homes list, API key management)

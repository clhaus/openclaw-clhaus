# cl.haus for OpenClaw

Everything you need to connect your [OpenClaw](https://github.com/openclaw/openclaw) instance to [cl.haus](https://cl.haus) — give your house an AI identity.

## What's Inside

| Component | Path | What It Does |
|-----------|------|-------------|
| **Channel Plugin** | `channel/` | WebSocket connection to cl.haus — users chat via PWA, your agent responds |
| **Skill** | `skill/` | API tools for managing home data (rooms, systems, photos, members) |
| **LLM Provider** | `provider/` | Config template to route LLM calls through cl.haus's metered proxy |

## Quick Start

```bash
# Clone
git clone https://github.com/clhaus/openclaw-clhaus.git
cd openclaw-clhaus

# Run setup (symlinks skill, fixes ws dependency, prints config)
./setup.sh

# Follow the printed instructions to configure openclaw.json
# Then restart:
openclaw gateway restart
```

## What You Get

**Chat with your house** — Users send messages through the cl.haus PWA (mobile-friendly). Your OpenClaw agent responds with its full personality — SOUL.md, memory, tools, everything.

**Home knowledge** — The agent automatically receives room, system, and member info with each message. It can also manage home data directly via the skill's API tools.

**No public URL needed** — OpenClaw connects *outbound* to cl.haus via WebSocket (like Telegram or Discord). No Tailscale, no port forwarding.

```
cl.haus PWA → cl.haus server → WebSocket → OpenClaw → your agent → response → PWA
```

## Prerequisites

1. OpenClaw installed and running (`openclaw status` shows green)
2. A [cl.haus](https://cl.haus) account with a home and API key

## Manual Setup

If you prefer not to use `setup.sh`:

### 1. Fix ws dependency

```bash
cd channel
mkdir -p node_modules
ln -s /usr/lib/node_modules/openclaw/node_modules/ws node_modules/ws
```

### 2. Install skill

```bash
ln -s /path/to/openclaw-clhaus/skill ~/.openclaw/skills/clhaus
```

### 3. Configure openclaw.json

**Plugin registration:**
```jsonc
{
  "plugins": {
    "load": {
      "paths": ["/path/to/openclaw-clhaus/channel"]
    },
    "entries": {
      "clhaus": { "enabled": true }
    }
  }
}
```

**Channel:**
```jsonc
{
  "channels": {
    "clhaus": {
      "enabled": true,
      "serverUrl": "https://cl.haus",
      "homeId": "<your-home-uuid>",
      "apiKey": "<your-clk_-api-key>",
      "dm": { "allowFrom": ["*"] }
    }
  }
}
```

**LLM Proxy (optional):** See `provider/provider-config.jsonc` — copy into `models.providers` in your openclaw.json.

**Skill env vars:**
```bash
export CLHAUS_API_KEY="clk_..."
export CLHAUS_HOME_ID="<your-home-uuid>"
export CLHAUS_API_URL="https://cl.haus"
```

### 4. Clear cache and restart

```bash
rm -rf /tmp/jiti/
openclaw gateway restart
```

### 5. Verify

```bash
openclaw status --deep
# Look for: Claus: ON, OK
```

## ⚠️ Jiti Cache

OpenClaw transpiles TypeScript plugins via jiti and caches the result in `/tmp/jiti/`. **You must clear this cache** whenever you update plugin source files:

```bash
rm -rf /tmp/jiti/
openclaw gateway restart
```

Without this, OpenClaw will keep running stale compiled code.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `Claus: OFF` in status | Check `openclaw.json` has both `plugins.load.paths` and `channels.clhaus` |
| Plugin changes not taking effect | `rm -rf /tmp/jiti/` then restart |
| "house offline" in PWA | Gateway not running or WS auth failed — check API key |
| Plugin ID mismatch warning | Cosmetic, ignore |
| ws module not found | Run `./setup.sh` or manually symlink (see above) |

## Architecture

- **Channel plugin** connects outbound via WebSocket — no public URL needed
- **Per-user sessions** — each household member gets isolated conversation history
- **Home context injection** — agent receives room/system/member info with each message (cached 5min)
- **Image attachments** — photos from PWA are passed through OpenClaw's media pipeline

## Links

- [cl.haus](https://cl.haus) — the service
- [cl.haus server repo](https://github.com/clhaus/clhaus) — server, PWA, database
- [OpenClaw](https://github.com/openclaw/openclaw) — the AI agent platform

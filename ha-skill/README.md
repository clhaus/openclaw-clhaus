# Home Assistant OpenClaw Skill

OpenClaw skill for controlling Home Assistant smart home devices via the HA REST API.

## Installation

1. Clone this repo into your OpenClaw skills directory:
   ```bash
   cd ~/.openclaw/skills
   git clone https://github.com/clhaus/openclaw-clhaus.git /tmp/openclaw-clhaus
   cp -r /tmp/openclaw-clhaus/ha-skill ~/.openclaw/skills/ha
   ```

2. Set required environment variables (set automatically by `install-ha.sh` or `configure-ha.sh`):
   ```bash
   export HA_TOKEN="your-long-lived-access-token"
   export HA_URL="http://localhost:8123"  # optional, defaults to localhost
   ```

3. Restart OpenClaw to load the skill.

## Usage

The skill provides local Home Assistant control for agents to:
- List and query entity states (lights, sensors, switches, etc.)
- Call services (turn on/off, set temperature, trigger automations)
- List areas and get full state dumps

See SKILL.md for complete API documentation and examples.

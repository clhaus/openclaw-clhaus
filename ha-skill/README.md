# Home Assistant OpenClaw Skill

OpenClaw skill for controlling Home Assistant smart home devices via the HA REST API.

## Installation

1. Clone this repo into your OpenClaw skills directory:
   ```bash
   cd ~/.openclaw/skills
   git clone https://github.com/clhaus/openclaw-clhaus.git /tmp/openclaw-clhaus
   cp -r /tmp/openclaw-clhaus/ha-skill ~/.openclaw/skills/ha
   ```

2. Configure your HA access token (set automatically by the parent clhaus installer).
   To set up manually, either export the env var or write the token to a file:
   ```bash
   # Option 1: env var
   export HA_TOKEN="your-long-lived-access-token"

   # Option 2: token file
   mkdir -p "${XDG_CONFIG_HOME:-$HOME/.config}/ha"
   echo "your-long-lived-access-token" > "${XDG_CONFIG_HOME:-$HOME/.config}/ha/token"

   # Optional: override the default HA URL (http://localhost:8123)
   export HA_URL="http://your-ha-host:8123"
   ```

3. Restart OpenClaw to load the skill.

## Usage

The skill provides local Home Assistant control for agents to:
- List and query entity states (lights, sensors, switches, etc.)
- Call services (turn on/off, set temperature, trigger automations)
- List areas and get full state dumps

See SKILL.md for complete API documentation and examples.

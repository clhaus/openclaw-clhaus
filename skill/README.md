# cl.haus OpenClaw Skill

OpenClaw skill for interacting with the cl.haus home management API.

## Installation

1. Clone this repo into your OpenClaw skills directory:
   ```bash
   cd ~/.openclaw/skills
   git clone https://github.com/clhaus/openclaw-skill-clhaus.git clhaus
   ```

2. Set required environment variables:
   ```bash
   export CLHAUS_API_KEY="clk_your_key_here"
   export CLHAUS_HOME_ID="your-home-uuid"
   export CLHAUS_API_URL="https://cl.haus"  # optional, defaults to cl.haus
   ```

3. Restart OpenClaw to load the skill.

## Usage

The skill provides API access to cl.haus for agents to:
- Manage rooms and systems
- Upload and organize photos
- Track service records and consumables
- Query home data

See SKILL.md for complete API documentation and examples.

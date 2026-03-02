#!/usr/bin/env bash
# cl.haus OpenClaw Setup
# Run from the repo root: ./setup.sh
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
OPENCLAW_DIR="${OPENCLAW_HOME:-$HOME/.openclaw}"

echo "🏠 cl.haus OpenClaw Setup"
echo "========================="
echo ""

# 1. Symlink ws dependency for channel plugin
echo "→ Setting up ws dependency for channel plugin..."
mkdir -p "$REPO_DIR/channel/node_modules"
OPENCLAW_WS="$(dirname "$(which openclaw 2>/dev/null || echo "/usr/lib/node_modules/openclaw/bin/openclaw")")/../node_modules/ws"
if [ ! -d "$OPENCLAW_WS" ]; then
  # Try common locations
  for candidate in /usr/lib/node_modules/openclaw/node_modules/ws /usr/local/lib/node_modules/openclaw/node_modules/ws; do
    if [ -d "$candidate" ]; then
      OPENCLAW_WS="$candidate"
      break
    fi
  done
fi
if [ -d "$OPENCLAW_WS" ]; then
  ln -sfn "$OPENCLAW_WS" "$REPO_DIR/channel/node_modules/ws"
  echo "  ✓ Linked ws from $OPENCLAW_WS"
else
  echo "  ⚠ Could not find OpenClaw's ws module. You may need to manually symlink:"
  echo "    ln -s /path/to/openclaw/node_modules/ws $REPO_DIR/channel/node_modules/ws"
fi

# 2. Symlink skill
echo "→ Installing cl.haus skill..."
mkdir -p "$OPENCLAW_DIR/skills"
ln -sfn "$REPO_DIR/skill" "$OPENCLAW_DIR/skills/clhaus"
echo "  ✓ Skill linked to $OPENCLAW_DIR/skills/clhaus"

# 3. Clear jiti cache
echo "→ Clearing jiti cache..."
rm -rf /tmp/jiti/
echo "  ✓ Cache cleared"

# 4. Print config instructions
echo ""
echo "✅ Installation complete!"
echo ""
echo "Next steps:"
echo ""
echo "1. Get your credentials from https://cl.haus:"
echo "   - Home ID (UUID)"
echo "   - API Key (starts with clk_)"
echo ""
echo "2. Add to your openclaw.json:"
echo ""
cat <<EOF
   // Plugin registration
   "plugins": {
     "load": {
       "paths": ["$REPO_DIR/channel"]
     },
     "entries": {
       "clhaus": { "enabled": true }
     }
   }

   // Channel config (in "channels" section)
   "channels": {
     "clhaus": {
       "enabled": true,
       "serverUrl": "https://cl.haus",
       "homeId": "<YOUR_HOME_ID>",
       "apiKey": "<YOUR_API_KEY>",
       "dm": { "allowFrom": ["*"] }
     }
   }
EOF
echo ""
echo "3. (Optional) Add LLM proxy provider — see provider/provider-config.jsonc"
echo ""
echo "4. Set skill env vars:"
echo "   export CLHAUS_API_KEY=\"clk_...\""
echo "   export CLHAUS_HOME_ID=\"<your-home-uuid>\""
echo "   export CLHAUS_API_URL=\"https://cl.haus\""
echo ""
echo "5. Restart OpenClaw:"
echo "   openclaw gateway restart"
echo ""
echo "6. Verify:"
echo "   openclaw status --deep   # Look for 'Claus: ON, OK'"

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { clhausPlugin } from "./src/channel.js";
import { setClhausRuntime } from "./src/runtime.js";

const plugin = {
  id: "clhaus",
  name: "Claus",
  description: "cl.haus channel plugin — chat with your house via WebSocket",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setClhausRuntime(api.runtime);
    api.registerChannel({ plugin: clhausPlugin });
    // No HTTP handler needed — plugin connects outbound via WebSocket
  },
};

export default plugin;

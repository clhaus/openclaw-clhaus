import type { PluginRuntime } from "openclaw/plugin-sdk";

let _runtime: PluginRuntime | null = null;

export function setClhausRuntime(runtime: PluginRuntime): void {
  _runtime = runtime;
}

export function getClhausRuntime(): PluginRuntime {
  if (!_runtime) {
    throw new Error("clhaus runtime not initialized");
  }
  return _runtime;
}

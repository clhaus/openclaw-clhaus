import type { OpenClawConfig } from "openclaw/plugin-sdk";

/**
 * cl.haus channel configuration.
 *
 * In openclaw.json:
 * ```json5
 * {
 *   channels: {
 *     clhaus: {
 *       serverUrl: "https://cl.haus",
 *       homeId: "uuid",
 *       apiKey: "clk_...",
 *       dm: { allowFrom: ["*"] }
 *     }
 *   }
 * }
 * ```
 */
export type ClhausChannelConfig = {
  /** cl.haus server URL */
  serverUrl?: string;
  /** Home ID this OpenClaw instance represents */
  homeId?: string;
  /** API key for authenticating with cl.haus (home-scoped) */
  apiKey?: string;
  /** DM configuration */
  dm?: {
    /** cl.haus userIds allowed to chat. ["*"] allows all home members. */
    allowFrom?: string[];
  };
  /** Whether channel is enabled */
  enabled?: boolean;
};

export type ResolvedClhausAccount = {
  accountId: string;
  config: ClhausChannelConfig;
  serverUrl: string;
  homeId: string;
  apiKey: string;
};

export function resolveClhausAccount(params: {
  cfg: OpenClawConfig;
  accountId?: string | null;
}): ResolvedClhausAccount {
  const raw = (params.cfg as any).channels?.clhaus ?? {};
  const serverUrl = raw.serverUrl ?? "";
  const homeId = raw.homeId ?? "";
  const apiKey = raw.apiKey ?? "";

  return {
    accountId: params.accountId ?? "default",
    config: raw,
    serverUrl,
    homeId,
    apiKey,
  };
}

export function isClhausConfigured(account: ResolvedClhausAccount): boolean {
  return !!(account.serverUrl && account.homeId && account.apiKey);
}

import type { ChannelPlugin, OpenClawConfig } from "openclaw/plugin-sdk";
import { buildChannelConfigSchema } from "openclaw/plugin-sdk";
import {
  resolveClhausAccount,
  isClhausConfigured,
  type ResolvedClhausAccount,
} from "./config.js";
import { startConnection } from "./connection.js";
import { deliverClhausResponse } from "./outbound.js";

export const clhausPlugin: ChannelPlugin<ResolvedClhausAccount> = {
  id: "clhaus",
  meta: {
    id: "clhaus",
    label: "Claus",
    selectionLabel: "Claus (cl.haus)",
    docsPath: "/channels/clhaus",
    docsLabel: "clhaus",
    blurb: "Chat with your house through cl.haus.",
    aliases: ["claus"],
    quickstartAllowFrom: true,
  },
  capabilities: {
    chatTypes: ["direct"],
    reactions: false,
    threads: false,
    media: false,
    nativeCommands: false,
    blockStreaming: true,
  },
  reload: { configPrefixes: ["channels.clhaus"] },
  config: {
    listAccountIds: (_cfg: OpenClawConfig) => ["default"],
    resolveAccount: (cfg: OpenClawConfig, accountId?: string | null) =>
      resolveClhausAccount({ cfg, accountId }),
    defaultAccountId: (_cfg: OpenClawConfig) => "default",
    isEnabled: (account: ResolvedClhausAccount, _cfg: OpenClawConfig) =>
      account.config.enabled !== false,
    isConfigured: (account: ResolvedClhausAccount, _cfg: OpenClawConfig) =>
      isClhausConfigured(account),
    unconfiguredReason: (_account: ResolvedClhausAccount, _cfg: OpenClawConfig) =>
      "cl.haus requires serverUrl, homeId, and apiKey in channels.clhaus config",
    describeAccount: (account: ResolvedClhausAccount, _cfg: OpenClawConfig) => ({
      accountId: account.accountId,
      configured: isClhausConfigured(account),
      enabled: account.config.enabled !== false,
      baseUrl: account.serverUrl,
    }),
    resolveAllowFrom: ({ cfg }: { cfg: OpenClawConfig }) => {
      const raw = (cfg as any).channels?.clhaus?.dm?.allowFrom;
      return Array.isArray(raw) ? raw.map(String) : undefined;
    },
  },
  pairing: {
    idLabel: "clhausUserId",
    normalizeAllowEntry: (entry: string) =>
      entry.trim().replace(/^(clhaus|claus):/i, ""),
  },
  outbound: {
    deliveryMode: "direct",
    textChunkLimit: 4000,
    sendText: async (ctx) => {
      const account = resolveClhausAccount({ cfg: ctx.cfg });
      if (!isClhausConfigured(account)) {
        return { ok: false, error: "clhaus not configured" } as any;
      }

      const userId = ctx.to.replace(/^clhaus:/i, "");

      // For proactive outbound, we need a conversation ID.
      // TODO: Create a dedicated proactive endpoint on cl.haus
      await deliverClhausResponse({
        serverUrl: account.serverUrl,
        homeId: account.homeId,
        apiKey: account.apiKey,
        conversationId: "__proactive__",
        content: ctx.text,
        userId,
      });

      return { ok: true, messageId: `clhaus:${Date.now()}` } as any;
    },
  },
  gateway: {
    startAccount: async (ctx) => {
      const account = ctx.account;

      if (!isClhausConfigured(account)) {
        throw new Error("cl.haus channel requires serverUrl, homeId, and apiKey");
      }

      ctx.log?.info(`[clhaus] connecting to ${account.serverUrl}`);
      ctx.setStatus({
        accountId: account.accountId,
        running: true,
        lastStartAt: Date.now(),
        baseUrl: account.serverUrl,
      });

      const stopConnection = startConnection({
        serverUrl: account.serverUrl,
        homeId: account.homeId,
        apiKey: account.apiKey,
        allowFrom: account.config.dm?.allowFrom,
        abortSignal: ctx.abortSignal,
        onStatusChange: (online) => {
          ctx.setStatus({
            accountId: account.accountId,
            running: online,
            lastStartAt: Date.now(),
            baseUrl: account.serverUrl,
            connected: online,
          });
        },
      });

      // Park the promise until the gateway signals abort.
      // OpenClaw treats startAccount() resolving as "channel stopped" and
      // triggers auto-restart. We must stay pending for the channel's lifetime.
      // See: OpenClaw LINE #26528, Google Chat #27384, Nextcloud Talk #27897
      await new Promise<void>((resolve) => {
        if (ctx.abortSignal.aborted) { resolve(); return; }
        ctx.abortSignal.addEventListener("abort", () => resolve(), { once: true });
      });

      stopConnection();
      ctx.setStatus({
        accountId: account.accountId,
        running: false,
        lastStopAt: Date.now(),
      });
    },
  },
};

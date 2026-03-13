/**
 * WebSocket connection manager — connects to cl.haus and receives chat events.
 * Replaces the webhook-based inbound transport.
 */
import WebSocket from "ws";
import { writeFile, mkdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  createReplyPrefixOptions,
  loadWebMedia,
} from "openclaw/plugin-sdk";
import { getClhausRuntime } from "./runtime.js";
import { resolveClhausAccount, isClhausConfigured } from "./config.js";
import { deliverClhausResponse } from "./outbound.js";

export type ConnectionOptions = {
  serverUrl: string;
  homeId: string;
  apiKey: string;
  allowFrom?: string[];
  abortSignal: AbortSignal;
  onStatusChange?: (online: boolean) => void;
};

type ChatMessageEvent = {
  type: "chat.message";
  conversationId: string;
  userId: string;
  userName: string;
  content: string;
  homeId: string;
  timestamp: string;
  attachments?: Array<{ type: string; url: string; mimeType: string; originalFilename: string }>;
};

const MIN_BACKOFF = 1_000;
const MAX_BACKOFF = 60_000;

export function startConnection(opts: ConnectionOptions): () => void {
  let ws: WebSocket | null = null;
  let backoff = MIN_BACKOFF;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;

  function connect() {
    if (stopped || opts.abortSignal.aborted) return;

    // Derive WSS URL from server URL
    const wsUrl = opts.serverUrl
      .replace(/^https:/, "wss:")
      .replace(/^http:/, "ws:")
      .replace(/\/$/, "") + "/ws/home";

    const core = getClhausRuntime();
    core.logging.shouldLogVerbose() &&
      console.log(`[clhaus] connecting to ${wsUrl}`);

    ws = new WebSocket(wsUrl);

    ws.on("open", () => {
      // Authenticate with API key
      ws!.send(JSON.stringify({ type: "auth", apiKey: opts.apiKey }));
    });

    ws.on("message", (raw: Buffer | string) => {
      let msg: any;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
      } catch {
        return;
      }

      if (msg.type === "auth.ok") {
        backoff = MIN_BACKOFF; // Reset backoff on successful connection
        opts.onStatusChange?.(true);
        const core = getClhausRuntime();
        core.logging.shouldLogVerbose() &&
          console.log(`[clhaus] connected and authenticated for home ${msg.homeId}`);
        return;
      }

      if (msg.type === "auth.error") {
        console.error(`[clhaus] auth failed: ${msg.error}`);
        ws?.close();
        return;
      }

      if (msg.type === "ping") {
        ws?.send(JSON.stringify({ type: "pong" }));
        return;
      }

      if (msg.type === "replaced") {
        console.log(`[clhaus] connection replaced: ${msg.reason}`);
        // Don't reconnect — we've been replaced by another instance
        stopped = true;
        return;
      }

      if (msg.type === "chat.message") {
        const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
        console.log(`[clhaus] chat.message received: content="${(msg.content ?? "").slice(0, 50)}" attachments=${hasAttachments ? msg.attachments.length : 0}${hasAttachments ? ` urls=${msg.attachments.map((a: any) => a.url ? "yes" : "no").join(",")}` : ""}`);
        void handleChatMessage(msg as ChatMessageEvent, opts).catch((err) => {
          console.error(`[clhaus] failed processing chat message: ${String(err)}`);
        });
        return;
      }

      if (msg.type === "error") {
        console.error(`[clhaus] server error: ${msg.error}`);
        return;
      }
    });

    ws.on("close", (code: number) => {
      opts.onStatusChange?.(false);
      if (stopped || opts.abortSignal.aborted) return;

      // Don't reconnect on auth failures
      if (code === 4003 || code === 4004) {
        console.error("[clhaus] auth failure — not reconnecting");
        return;
      }

      const core = getClhausRuntime();
      core.logging.shouldLogVerbose() &&
        console.log(`[clhaus] disconnected (code ${code}), reconnecting in ${backoff}ms`);

      reconnectTimer = setTimeout(() => {
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
        connect();
      }, backoff);
    });

    ws.on("error", (err: Error) => {
      // Error will be followed by close event — reconnect handled there
      const core = getClhausRuntime();
      core.logging.shouldLogVerbose() &&
        console.error(`[clhaus] WebSocket error: ${err.message}`);
    });
  }

  // Listen for abort signal
  opts.abortSignal.addEventListener("abort", () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Shutting down");
    }
  });

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close(1000, "Shutting down");
    }
  };
}

/** Cache home context to avoid fetching on every message */
let homeContextCache: { text: string; fetchedAt: number } | null = null;
const HOME_CONTEXT_TTL = 5 * 60 * 1000; // 5 minutes

async function fetchHomeContext(opts: ConnectionOptions): Promise<string> {
  if (homeContextCache && Date.now() - homeContextCache.fetchedAt < HOME_CONTEXT_TTL) {
    return homeContextCache.text;
  }

  const headers = { Authorization: `Bearer ${opts.apiKey}` };
  const base = opts.serverUrl.replace(/\/$/, "");

  try {
    const [roomsRes, systemsRes, membersRes] = await Promise.all([
      fetch(`${base}/api/homes/${opts.homeId}/rooms`, { headers }),
      fetch(`${base}/api/homes/${opts.homeId}/systems`, { headers }),
      fetch(`${base}/api/homes/${opts.homeId}/members`, { headers }),
    ]);

    const rooms = roomsRes.ok ? await roomsRes.json() : [];
    const systems = systemsRes.ok ? await systemsRes.json() : [];
    const members = membersRes.ok ? (await membersRes.json()).members ?? [] : [];

    const parts: string[] = ["[Home Context]"];

    if (Array.isArray(members) && members.length > 0) {
      parts.push(`Household members: ${members.map((m: any) => `${m.name || m.email} (${m.role})`).join(", ")}`);
    }

    const roomList = Array.isArray(rooms) ? rooms : [];
    if (roomList.length > 0) {
      parts.push(`Rooms: ${roomList.map((r: any) => r.name + (r.floor ? ` (floor ${r.floor})` : "")).join(", ")}`);
    }

    const sysList = Array.isArray(systems) ? systems : [];
    if (sysList.length > 0) {
      const sysLines = sysList.map((s: any) => {
        const details = [s.type, s.manufacturer, s.model].filter(Boolean).join(" ");
        return `- ${s.name}${details ? ` (${details})` : ""}`;
      });
      parts.push(`Systems:\n${sysLines.join("\n")}`);
    }

    if (parts.length === 1) {
      parts.push("No rooms or systems configured yet.");
    }

    const text = parts.join("\n");
    homeContextCache = { text, fetchedAt: Date.now() };
    return text;
  } catch (err) {
    console.error(`[clhaus] failed fetching home context: ${String(err)}`);
    return "";
  }
}

async function handleChatMessage(
  event: ChatMessageEvent,
  opts: ConnectionOptions,
): Promise<void> {
  const core = getClhausRuntime();
  const config = core.config.loadConfig();

  const account = resolveClhausAccount({ cfg: config });
  if (!isClhausConfigured(account)) {
    console.error("[clhaus] channel not configured — dropping inbound message");
    return;
  }

  // Enforce allowFrom if configured
  const allowFrom = opts.allowFrom;
  if (allowFrom && !allowFrom.includes("*")) {
    const normalized = event.userId.replace(/^(clhaus|claus):/i, "");
    if (!allowFrom.some(entry => entry.replace(/^(clhaus|claus):/i, "") === normalized)) {
      console.error(`[clhaus] userId ${event.userId} not in allowFrom — dropping message`);
      return;
    }
  }

  // Route to the correct agent/session based on the cl.haus userId
  const route = core.channel.routing.resolveAgentRoute({
    cfg: config,
    channel: "clhaus",
    accountId: "default",
    peer: {
      kind: "direct",
      id: `clhaus:${event.userId}`,
    },
  });

  const senderName = event.userName || `User ${event.userId.slice(0, 8)}`;
  const storePath = core.channel.session.resolveStorePath(config.session?.store, {
    agentId: route.agentId,
  });
  const envelopeOptions = core.channel.reply.resolveEnvelopeFormatOptions(config);
  const previousTimestamp = core.channel.session.readSessionUpdatedAt({
    storePath,
    sessionKey: route.sessionKey,
  });

  // Fetch home context (rooms, systems, members) — cached for 5 min
  const homeContext = await fetchHomeContext(opts);

  const body = core.channel.reply.formatAgentEnvelope({
    channel: "Claus",
    from: senderName,
    timestamp: event.timestamp ? Date.parse(event.timestamp) : undefined,
    previousTimestamp,
    envelope: envelopeOptions,
    body: event.content,
  });

  // Download image attachments and save to local temp files.
  // Pre-signed S3 URLs expire quickly, so we fetch immediately while they're fresh.
  // We save to disk and pass file paths — OpenClaw's pipeline reads local files,
  // creates [media attached: /path (type)] tags, and detectAndLoadPromptImages()
  // loads them as image_url content blocks for the LLM (same as Telegram channel).
  const mediaPaths: string[] = [];
  const mediaTypes: string[] = [];
  if (event.attachments?.length) {
    const mediaDir = "/tmp/openclaw/clhaus-inbound";
    await mkdir(mediaDir, { recursive: true });
    const results = await Promise.allSettled(
      event.attachments
        .filter(a => a.url && a.mimeType?.startsWith("image/"))
        .map(async (att) => {
          const media = await loadWebMedia(att.url, 5 * 1024 * 1024);
          const ct = media.contentType || att.mimeType;
          const ext = ct.split("/")[1]?.split(";")[0] || "jpg";
          const filePath = path.join(mediaDir, `${randomUUID()}.${ext}`);
          await writeFile(filePath, Buffer.from(media.buffer));
          return { path: filePath, contentType: ct };
        }),
    );
    for (const r of results) {
      if (r.status === "fulfilled") {
        mediaPaths.push(r.value.path);
        mediaTypes.push(r.value.contentType);
      } else {
        console.error(`[clhaus] failed downloading attachment: ${r.reason}`);
      }
    }
    if (mediaPaths.length > 0) {
      console.log(`[clhaus] saved ${mediaPaths.length} attachment(s) to disk: ${mediaPaths.join(", ")}`);
    }
  }

  // Build agent-visible body with home context — don't add manual image text,
  // OpenClaw's buildInboundMediaNote() handles the [media attached: ...] tags.
  const parts: string[] = [];
  if (homeContext) parts.push(homeContext);
  parts.push(`[From: ${senderName}]`);
  parts.push(event.content);
  const agentBody = parts.join("\n\n");

  const ctxPayload = core.channel.reply.finalizeInboundContext({
    Body: body,
    BodyForAgent: agentBody,
    RawBody: event.content,
    CommandBody: event.content,
    From: `clhaus:${event.userId}`,
    To: `clhaus:${event.homeId}`,
    SessionKey: route.sessionKey,
    AccountId: route.accountId,
    ChatType: "direct",
    ConversationLabel: `${senderName} (${event.homeId.slice(0, 8)})`,
    SenderName: senderName,
    SenderId: event.userId,
    CommandAuthorized: true,
    Provider: "clhaus",
    Surface: "clhaus",
    MessageSid: `${event.conversationId}:${Date.now()}`,
    OriginatingChannel: "clhaus",
    OriginatingTo: `clhaus:${event.homeId}`,
    ...(mediaPaths.length > 0 ? {
      MediaPath: mediaPaths[0],
      MediaType: mediaTypes[0],
      MediaUrl: mediaPaths[0],
      MediaPaths: mediaPaths,
      MediaUrls: mediaPaths,
      MediaTypes: mediaTypes,
    } : {}),
  });

  // Record session metadata
  void core.channel.session
    .recordSessionMetaFromInbound({
      storePath,
      sessionKey: ctxPayload.SessionKey ?? route.sessionKey,
      ctx: ctxPayload,
    })
    .catch((err: unknown) => {
      console.error(`[clhaus] failed updating session meta: ${String(err)}`);
    });

  const { onModelSelected, ...prefixOptions } = createReplyPrefixOptions({
    cfg: config,
    agentId: route.agentId,
    channel: "clhaus",
    accountId: route.accountId,
  });

  // Dispatch to agent and deliver response back to cl.haus
  await core.channel.reply.dispatchReplyWithBufferedBlockDispatcher({
    ctx: ctxPayload,
    cfg: config,
    dispatcherOptions: {
      ...prefixOptions,
      deliver: async (replyPayload) => {
        const text = replyPayload.text ?? "";
        if (!text.trim()) return;

        await deliverClhausResponse({
          serverUrl: account.serverUrl,
          homeId: account.homeId,
          apiKey: account.apiKey,
          conversationId: event.conversationId,
          content: text,
          userId: event.userId,
        });
      },
      onError: (err, info) => {
        console.error(`[clhaus] ${info.kind} reply failed: ${String(err)}`);
      },
    },
    replyOptions: {
      onModelSelected,
    },
  });
}

#!/usr/bin/env node
// ha-client.mjs — Home Assistant skill for OpenClaw
// Phase 1: REST commands (drop-in replacement for ha-api.sh)
// Phase 2: WebSocket Z-Wave read-only commands (zwave-nodes, zwave-list-provisioned)
// Phase 3: Smart Start provisioning (parse-qr, provision, unprovision, scan-qr)

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

// ── Config ──────────────────────────────────────────────

const HA_URL = (process.env.HA_URL || "http://localhost:8123").replace(
  /\/$/,
  ""
);

function loadToken() {
  if (process.env.HA_TOKEN) return process.env.HA_TOKEN;
  const tokenPath =
    process.env.XDG_CONFIG_HOME
      ? join(process.env.XDG_CONFIG_HOME, "ha", "token")
      : join(homedir(), ".config", "ha", "token");
  try {
    return readFileSync(tokenPath, "utf8").trim();
  } catch {
    return null;
  }
}

const TOKEN = loadToken();

function requireToken() {
  if (!TOKEN) {
    const configDir = process.env.XDG_CONFIG_HOME || "$HOME/.config";
    error(
      `HA_TOKEN not set. Export HA_TOKEN or write your token to ${configDir}/ha/token.`
    );
  }
  return TOKEN;
}

// ── HTTP ────────────────────────────────────────────────

async function haFetch(path, options = {}) {
  const token = requireToken();
  const url = `${HA_URL}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    error(`HTTP ${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

// ── Output helpers ──────────────────────────────────────

function json(data) {
  process.stdout.write(JSON.stringify(data, null, 2) + "\n");
}

function error(msg) {
  process.stderr.write(JSON.stringify({ error: msg }) + "\n");
  process.exit(1);
}

function tsv(rows) {
  if (rows.length === 0) return;
  // Calculate column widths for alignment
  const widths = rows[0].map((_, i) =>
    Math.max(...rows.map((r) => (r[i] || "").length))
  );
  for (const row of rows) {
    const line = row
      .map((cell, i) => (cell || "").padEnd(widths[i]))
      .join("  ");
    process.stdout.write(line.trimEnd() + "\n");
  }
}

// ── WebSocket ───────────────────────────────────────────

function wsUrl() {
  return HA_URL.replace(/^http/, "ws") + "/api/websocket";
}

// Send a single WS command and return the result. Opens/closes the connection.
async function wsCommand(type, params = {}) {
  const token = requireToken();
  const ws = new WebSocket(wsUrl());
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("WebSocket command timed out"));
    }, 15000);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "auth_required") {
        ws.send(JSON.stringify({ type: "auth", access_token: token }));
        return;
      }
      if (data.type === "auth_ok") {
        ws.send(JSON.stringify({ type, id: 1, ...params }));
        return;
      }
      if (data.type === "auth_invalid") {
        clearTimeout(timeout);
        ws.close();
        reject(new Error("Authentication failed"));
        return;
      }
      if (data.id === 1 && data.type === "result") {
        clearTimeout(timeout);
        ws.close();
        if (data.success) {
          resolve(data.result);
        } else {
          reject(new Error(data.error?.message || "WebSocket command failed"));
        }
      }
    };
    ws.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Cannot connect to Home Assistant WebSocket at ${wsUrl()}`));
    };
  });
}

// ── Z-Wave helpers ──────────────────────────────────────

const STATUS_NAMES = { 0: "unknown", 1: "asleep", 4: "alive" };

async function getZwaveEntryId() {
  if (process.env.HA_ZWAVE_ENTRY_ID) return process.env.HA_ZWAVE_ENTRY_ID;
  const entries = await wsCommand("config_entries/get");
  const zwave = entries.filter((e) => e.domain === "zwave_js");
  if (zwave.length === 0) error("Z-Wave JS integration not found in Home Assistant.");
  if (zwave[0].state !== "loaded") error(`Z-Wave JS integration is not loaded (state: ${zwave[0].state}).`);
  return zwave[0].entry_id;
}

// Build a map of zwave node_id → { device_id, name, manufacturer, model, area_id }
async function getZwaveDeviceMap() {
  const devices = await wsCommand("config/device_registry/list");
  const map = new Map();
  for (const d of devices) {
    const zwId = d.identifiers?.find((id) => id[0] === "zwave_js");
    if (!zwId) continue;
    // Identifier format: "<home_id>-<node_id>" or "<home_id>-<node_id>-<mfr>:<prod>:<id>"
    const match = zwId[1].match(/^\d+-(\d+)/);
    if (!match) continue;
    const nodeId = parseInt(match[1], 10);
    map.set(nodeId, {
      device_id: d.id,
      name: d.name_by_user || d.name,
      manufacturer: d.manufacturer,
      model: d.model,
      area_id: d.area_id,
    });
  }
  return map;
}

// ── Z-Wave Commands ─────────────────────────────────────

async function zwaveNodes() {
  const entryId = await getZwaveEntryId();
  const status = await wsCommand("zwave_js/network_status", { entry_id: entryId });
  const deviceMap = await getZwaveDeviceMap();

  const nodes = status.controller.nodes
    .filter((n) => !n.is_controller_node)
    .map((n) => {
      const dev = deviceMap.get(n.node_id) || {};
      return {
        node_id: n.node_id,
        name: dev.name || null,
        status: STATUS_NAMES[n.status] || String(n.status),
        ready: n.ready,
        secure: n.is_secure || false,
        manufacturer: dev.manufacturer || null,
        model: dev.model || null,
        area: dev.area_id || null,
        device_id: dev.device_id || null,
      };
    });
  json(nodes);
}

async function zwaveListProvisioned() {
  const entryId = await getZwaveEntryId();
  const entries = await wsCommand("zwave_js/get_provisioning_entries", { entry_id: entryId });
  json(entries);
}

async function zwaveParseQr(qrCodeString) {
  if (!qrCodeString) error("Usage: ha zwave-parse-qr <qr_code_string>");
  const entryId = await getZwaveEntryId();
  const info = await wsCommand("zwave_js/parse_qr_code_string", {
    entry_id: entryId,
    qr_code_string: qrCodeString,
  });
  json(info);
}

async function zwaveProvision(qrInfoArg) {
  if (!qrInfoArg) error("Usage: ha zwave-provision <qr_provisioning_info_json>");
  let qrInfo;
  try {
    qrInfo = JSON.parse(qrInfoArg);
  } catch {
    error(`Invalid JSON: ${qrInfoArg}`);
  }
  const entryId = await getZwaveEntryId();
  await wsCommand("zwave_js/provision_smart_start_node", {
    entry_id: entryId,
    qr_provisioning_information: qrInfo,
  });
  json({ success: true, dsk: qrInfo.dsk });
}

async function zwaveUnprovision(dsk) {
  if (!dsk) error("Usage: ha zwave-unprovision <dsk>");
  const entryId = await getZwaveEntryId();
  await wsCommand("zwave_js/unprovision_smart_start_node", {
    entry_id: entryId,
    dsk,
  });
  json({ success: true, dsk });
}

async function zwaveScanQr(imagePath) {
  if (!imagePath) error("Usage: ha zwave-scan-qr <image_path>");
  // Decode QR from image using zbarimg CLI
  const { execSync } = await import("child_process");
  let qrString;
  try {
    qrString = execSync(`zbarimg --raw -q "${imagePath}"`, {
      encoding: "utf8",
      timeout: 10000,
    }).trim();
  } catch (e) {
    if (e.status === 4) error("No QR code found in image.");
    error(`QR decode failed: ${e.message}`);
  }
  if (!qrString) error("No QR code found in image.");
  // Parse the QR string via HA
  const entryId = await getZwaveEntryId();
  const qrInfo = await wsCommand("zwave_js/parse_qr_code_string", {
    entry_id: entryId,
    qr_code_string: qrString,
  });
  // Provision
  await wsCommand("zwave_js/provision_smart_start_node", {
    entry_id: entryId,
    qr_provisioning_information: qrInfo,
  });
  json({ success: true, dsk: qrInfo.dsk, qr_info: qrInfo });
}

// ── REST Commands ───────────────────────────────────────

async function listEntities(domain) {
  const states = await haFetch("/api/states");
  let filtered = states;
  if (domain) {
    filtered = states.filter((s) => s.entity_id.startsWith(domain + "."));
  }
  filtered.sort((a, b) => a.entity_id.localeCompare(b.entity_id));
  const rows = filtered.map((s) => [
    s.entity_id,
    s.state,
    s.attributes?.friendly_name || "",
  ]);
  tsv(rows);
}

async function getState(entityId) {
  if (!entityId) error("Usage: ha get-state <entity_id>");
  const state = await haFetch(`/api/states/${entityId}`);
  json(state);
}

async function callService(domain, service, entityId, extraJson) {
  if (!domain || !service || !entityId) {
    error("Usage: ha call-service <domain> <service> <entity_id> [json]");
  }
  let body = { entity_id: entityId };
  if (extraJson) {
    try {
      body = { ...JSON.parse(extraJson), entity_id: entityId };
    } catch {
      error(`Invalid JSON: ${extraJson}`);
    }
  }
  const result = await haFetch(`/api/services/${domain}/${service}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
  json(result);
}

async function listAreas() {
  const areas = await wsCommand("config/area_registry/list");
  json(areas);
}

async function states() {
  const allStates = await haFetch("/api/states");
  json(allStates);
}

function help() {
  process.stdout.write(`Home Assistant skill

Device Control (REST):
  list-entities [domain]                              List entities (optionally filter by domain)
  get-state <entity_id>                               Get state of a single entity
  call-service <domain> <service> <entity_id> [json]  Call a service on an entity
  list-areas                                          List configured areas
  states                                              Full state dump (JSON)

Z-Wave (WebSocket):
  zwave-nodes                                         List all Z-Wave nodes with status
  zwave-list-provisioned                              List Smart Start provisioning entries
  zwave-parse-qr <qr_code_string>                    Parse Z-Wave QR code string
  zwave-provision <qr_info_json>                      Add device to Smart Start list
  zwave-unprovision <dsk>                             Remove device from Smart Start list
  zwave-scan-qr <image_path>                          Decode QR from image + provision

  help                                                Show this help

Domains: light, switch, sensor, binary_sensor, climate, cover, media_player, automation, scene, lock

Env: HA_TOKEN (required), HA_URL (default: http://localhost:8123)
     HA_ZWAVE_ENTRY_ID (optional, auto-discovered)
`);
}

// ── Main ────────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

try {
  switch (cmd) {
    case "list-entities":
      await listEntities(args[0]);
      break;
    case "get-state":
      await getState(args[0]);
      break;
    case "call-service":
      await callService(args[0], args[1], args[2], args[3]);
      break;
    case "list-areas":
      await listAreas();
      break;
    case "states":
      await states();
      break;
    case "zwave-nodes":
      await zwaveNodes();
      break;
    case "zwave-list-provisioned":
      await zwaveListProvisioned();
      break;
    case "zwave-parse-qr":
      await zwaveParseQr(args[0]);
      break;
    case "zwave-provision":
      await zwaveProvision(args[0]);
      break;
    case "zwave-unprovision":
      await zwaveUnprovision(args[0]);
      break;
    case "zwave-scan-qr":
      await zwaveScanQr(args[0]);
      break;
    case "help":
    case undefined:
      help();
      break;
    default:
      error(`Unknown command: ${cmd}. Run 'ha help' for usage.`);
  }
} catch (e) {
  if (e.cause?.code === "ECONNREFUSED") {
    error(`Cannot connect to Home Assistant at ${HA_URL}`);
  }
  error(e.message);
}

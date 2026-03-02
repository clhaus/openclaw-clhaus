/**
 * Outbound delivery — POST responses back to cl.haus server.
 */

export type DeliverParams = {
  serverUrl: string;
  homeId: string;
  apiKey: string;
  conversationId: string;
  content: string;
  userId: string;
};

/**
 * Deliver an assistant response back to the cl.haus server.
 * cl.haus stores the message and pushes to connected PWA clients.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function deliverClhausResponse(params: DeliverParams): Promise<void> {
  const { serverUrl, homeId, apiKey, conversationId, content, userId } = params;

  if (!UUID_RE.test(homeId)) throw new Error("Invalid homeId format");
  if (!UUID_RE.test(conversationId)) throw new Error("Invalid conversationId format");

  const url = `${serverUrl}/api/homes/${homeId}/chat/conversations/${conversationId}/webhook`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      role: "assistant",
      content,
      userId,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`cl.haus delivery failed: ${response.status} ${text.slice(0, 200)}`);
  }
}

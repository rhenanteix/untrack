export function connectLog(
  metric: string,
  detail: {
    correlationId?: string;
    workspaceId?: string;
    sourceConnectionId?: string;
    receiptId?: string;
    attempt?: number;
    code?: string;
    durationMs?: number;
  } = {},
) {
  // Never log payloads, credentials, URLs, IPs, session identifiers, or exception messages.
  console.info(
    JSON.stringify({
      component: "linkor_connect",
      metric,
      at: new Date().toISOString(),
      ...detail,
    }),
  );
}

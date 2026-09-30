export function clickMetadata(headers: Headers, now = new Date()) {
  const agent = headers.get("user-agent") ?? "";
  if (
    /bot|crawler|spider|preview|facebookexternalhit|slack|whatsapp|telegram/i.test(
      agent,
    ) ||
    /prefetch/i.test(
      `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`,
    )
  )
    return null;
  let referrer = "Direto";
  try {
    const url = new URL(headers.get("referer") ?? "");
    if (["http:", "https:"].includes(url.protocol))
      referrer = url.hostname.slice(0, 253);
  } catch {
    /* Direct navigation has no referrer. */
  }
  const device = /ipad|tablet/i.test(agent)
    ? "Tablet"
    : /mobile|iphone|android/i.test(agent)
      ? "Celular"
      : agent
        ? "Desktop"
        : "Outro";
  return {
    day: new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    ),
    referrer,
    device,
  };
}

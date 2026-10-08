import { classifyBot } from "@/modules/analytics/device";

export function clickMetadata(headers: Headers, now = new Date()) {
  if (headers.get("dnt") === "1" || headers.get("sec-gpc") === "1")
    return null;
  const bot = classifyBot(headers);
  if (bot.isBot)
    return null;
  const agent = headers.get("user-agent") ?? "";
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

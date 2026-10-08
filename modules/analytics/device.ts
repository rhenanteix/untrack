export type DeviceDetails = {
  deviceType: "mobile" | "desktop" | "tablet" | "other";
  os: "android" | "ios" | "windows" | "macos" | "linux" | "other";
  browser: "chrome" | "safari" | "firefox" | "edge" | "other";
};

export type BotDetails = {
  isBot: boolean;
  botType?: "crawler" | "preview" | "automation";
};

export function classifyDevice(userAgent: string | null | undefined): DeviceDetails {
  const agent = userAgent?.toLowerCase() ?? "";
  const deviceType = /ipad|tablet/.test(agent)
    ? "tablet"
    : /mobile|iphone|android/.test(agent)
      ? "mobile"
      : agent
        ? "desktop"
        : "other";
  const os = /android/.test(agent)
    ? "android"
    : /iphone|ipad|ipod/.test(agent)
      ? "ios"
      : /windows/.test(agent)
        ? "windows"
        : /mac os|macintosh/.test(agent)
          ? "macos"
          : /linux/.test(agent)
            ? "linux"
            : "other";
  const browser = /edg\//.test(agent)
    ? "edge"
    : /firefox\//.test(agent)
      ? "firefox"
      : /chrome\/|crios\//.test(agent)
        ? "chrome"
        : /safari\//.test(agent)
          ? "safari"
          : "other";
  return { deviceType, os, browser };
}

export function classifyBot(headers: Headers): BotDetails {
  const agent = headers.get("user-agent")?.toLowerCase() ?? "";
  const purpose = `${headers.get("purpose") ?? ""} ${headers.get("sec-purpose") ?? ""}`.toLowerCase();
  if (/facebookexternalhit|slackbot|telegrambot|whatsapp|discordbot|twitterbot/.test(agent))
    return { isBot: true, botType: "preview" };
  if (/slack|whatsapp|telegram/i.test(agent))
    return { isBot: true, botType: "preview" };
  if (/bot|crawler|spider|google-inspectiontool/.test(agent))
    return { isBot: true, botType: "crawler" };
  if (/prefetch|prerender/.test(purpose))
    return { isBot: true, botType: "automation" };
  return { isBot: false };
}
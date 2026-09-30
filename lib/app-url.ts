export function appUrl(): URL {
  const value = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "NEXT_PUBLIC_APP_URL deve ser uma URL HTTP(S) sem credenciais.",
    );
  }
  return new URL(url.origin);
}

export function publicLinkUrl(slug: string, preview = false): string {
  return new URL(
    `/${preview ? "l" : "s"}/${encodeURIComponent(slug)}`,
    appUrl(),
  ).href;
}

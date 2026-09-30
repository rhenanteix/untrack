export function safeReturnPath(value: string | null | undefined): string {
  if (!value || value.includes("\\")) return "/conta";
  try {
    const parsed = new URL(value, "https://app.invalid");
    if (
      parsed.origin !== "https://app.invalid" ||
      !/^\/(conta|encurtar)(\/|$)/.test(parsed.pathname)
    )
      return "/conta";
    return parsed.pathname + parsed.search;
  } catch {
    return "/conta";
  }
}

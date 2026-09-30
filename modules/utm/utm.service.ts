import type { UtmInput } from "./utm.schemas";

/**
 * Applies campaign parameters to a URL. Existing UTM parameters are replaced
 * rather than duplicated, optional fields are dropped when omitted, and every
 * existing non-UTM parameter, the path and the fragment are preserved.
 */
export function generateUtmUrl(input: UtmInput): string {
  const url = new URL(input.url);

  url.searchParams.set("utm_source", input.source);
  url.searchParams.set("utm_medium", input.medium);
  url.searchParams.set("utm_campaign", input.campaign);

  for (const [key, value] of [
    ["utm_term", input.term],
    ["utm_content", input.content],
  ] as const) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }

  return url.toString();
}

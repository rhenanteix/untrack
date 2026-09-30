import { z } from "zod";

/**
 * Single source of truth for what a "web URL" means across every API.
 *
 * Accepts HTTP/HTTPS only, rejects embedded credentials and caps the length.
 * Hostname safety (SSRF) is enforced separately in `modules/validation/ssrf.ts`,
 * because that check requires DNS resolution and only applies to URLs the
 * server actually fetches.
 */
export const webUrlSchema = z
  .string()
  .trim()
  .min(1, "Informe uma URL.")
  .max(4_096, "A URL é muito longa.")
  .refine((value) => {
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        Boolean(url.hostname) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Informe uma URL HTTP ou HTTPS válida, sem credenciais.");

export const MAX_URL_LENGTH = 4_096;

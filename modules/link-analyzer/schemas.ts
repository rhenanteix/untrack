import { z } from "zod";
import { MAX_URL_LENGTH } from "@/modules/validation/url-validation";

// Invalid URL syntax is an analysis result; malformed API payloads are HTTP 400.
export const analyzeLinkSchema = z.object({
  url: z.string().max(MAX_URL_LENGTH, "A URL é muito longa."),
});

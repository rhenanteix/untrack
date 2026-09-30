import { analyzeLink } from "@/modules/link-analyzer/analyze";
import { evaluateLinkHealth } from "./evaluate";
import type { LinkHealthReport } from "./types";

/** Uses the Analyzer's DNS pinning, redirect validation, size limits and total timeout. */
export async function checkLinkHealth(url: string): Promise<LinkHealthReport> {
  return evaluateLinkHealth(await analyzeLink(url));
}

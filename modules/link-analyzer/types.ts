export interface AnalyzedParameter {
  name: string;
  value: string;
  reason: string;
}

export interface AnalysisIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  recommendation: string;
  penalty: number;
}

export interface RedirectHop {
  url: string;
  status: number;
  /** Resolved Location; this is not necessarily a safe or visited destination. */
  destination: string | null;
}

export interface LinkAnalysis {
  input: string;
  valid: boolean;
  normalizedUrl: string | null;
  protocol: string | null;
  hostname: string | null;
  /** Registrable domain from the Public Suffix List; null for IPs/local names. */
  domain: string | null;
  path: string | null;
  query: string | null;
  fragment: string | null;
  https: boolean;
  tracking: AnalyzedParameter[];
  functionalParameters: AnalyzedParameter[];
  unknownParameters: AnalyzedParameter[];
  networkStatus: "completed" | "blocked" | "failed" | "skipped";
  httpStatus: number | null;
  redirectChain: RedirectHop[];
  /** Number of redirect edges actually followed, not merely advertised. */
  redirectCount: number;
  responseTimeMs: number;
  /** Only set after a terminal HTTP response, including 4xx/5xx. */
  finalDestination: string | null;
  issues: AnalysisIssue[];
  recommendations: string[];
  healthScore: number;
}

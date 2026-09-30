import type { LinkAnalysis } from "@/modules/link-analyzer/types";
import type { HealthCheckId } from "./config";

export interface HealthCheck {
  id: HealthCheckId;
  label: string;
  status: "pass" | "fail" | "unknown";
  points: number;
  maxPoints: number;
  reason: string;
}
export interface HealthFinding {
  code: string;
  message: string;
  recommendation: string;
}
export interface LinkHealthReport {
  policyVersion: string;
  healthScore: number;
  maxScore: 100;
  scope: string;
  checks: HealthCheck[];
  problems: HealthFinding[];
  warnings: HealthFinding[];
  recommendations: string[];
  availability: "available" | "not-confirmed" | "not-checked";
  measurements: Pick<
    LinkAnalysis,
    | "input"
    | "valid"
    | "https"
    | "normalizedUrl"
    | "protocol"
    | "hostname"
    | "domain"
    | "path"
    | "query"
    | "fragment"
    | "networkStatus"
    | "httpStatus"
    | "responseTimeMs"
    | "redirectCount"
    | "redirectChain"
    | "finalDestination"
    | "tracking"
    | "functionalParameters"
    | "unknownParameters"
  >;
}

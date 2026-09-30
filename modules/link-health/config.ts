export const CHECK_IDS = [
  "https",
  "httpStatus",
  "redirects",
  "responseTime",
  "urlStructure",
  "tracking",
  "availability",
] as const;
export type HealthCheckId = (typeof CHECK_IDS)[number];

export interface HealthConfig {
  readonly version: string;
  readonly points: Readonly<Record<HealthCheckId, number>>;
  readonly maxAcceptableRedirects: number;
  readonly maxAcceptableResponseTimeMs: number;
  readonly successfulStatus: { readonly min: number; readonly max: number };
}

/** Product policy, not a security rating. See docs/link-health.md for every rule. */
export const LINK_HEALTH_CONFIG: HealthConfig = Object.freeze({
  version: "1.0.0",
  points: Object.freeze({
    https: 20,
    httpStatus: 25,
    redirects: 15,
    responseTime: 15,
    urlStructure: 10,
    tracking: 5,
    availability: 10,
  }),
  maxAcceptableRedirects: 2,
  maxAcceptableResponseTimeMs: 2_000,
  successfulStatus: Object.freeze({ min: 200, max: 299 }),
});

export function validateHealthConfig(config: HealthConfig): void {
  const points = CHECK_IDS.map((id) => config.points[id]);
  if (
    !config.version.trim() ||
    points.some((value) => !Number.isInteger(value) || value < 0) ||
    points.reduce((sum, value) => sum + value, 0) !== 100 ||
    !Number.isInteger(config.maxAcceptableRedirects) ||
    config.maxAcceptableRedirects < 0 ||
    !Number.isFinite(config.maxAcceptableResponseTimeMs) ||
    config.maxAcceptableResponseTimeMs < 0 ||
    !Number.isInteger(config.successfulStatus.min) ||
    !Number.isInteger(config.successfulStatus.max) ||
    config.successfulStatus.min < 200 ||
    config.successfulStatus.max > 299 ||
    config.successfulStatus.min > config.successfulStatus.max
  ) {
    throw new Error(
      "Configuração Link Health inválida: pesos inteiros não negativos devem somar 100; limites devem ser válidos e status de sucesso deve pertencer a 2xx.",
    );
  }
}

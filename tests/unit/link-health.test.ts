import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HealthResult } from "@/components/link-health";
import type { LinkAnalysis } from "@/modules/link-analyzer/types";
import { evaluateLinkHealth } from "@/modules/link-health/evaluate";
import {
  LINK_HEALTH_CONFIG,
  type HealthConfig,
} from "@/modules/link-health/config";

function analysis(overrides: Partial<LinkAnalysis> = {}): LinkAnalysis {
  return {
    input: "https://example.com/",
    valid: true,
    normalizedUrl: "https://example.com/",
    protocol: "https",
    hostname: "example.com",
    domain: "example.com",
    path: "/",
    query: "",
    fragment: "",
    https: true,
    tracking: [],
    functionalParameters: [],
    unknownParameters: [],
    networkStatus: "completed",
    httpStatus: 200,
    redirectChain: [],
    redirectCount: 0,
    responseTimeMs: 100,
    finalDestination: "https://example.com/",
    issues: [],
    recommendations: [],
    healthScore: 0,
    ...overrides,
  };
}
const check = (result: ReturnType<typeof evaluateLinkHealth>, id: string) =>
  result.checks.find((item) => item.id === id)!;

describe("Link Health policy", () => {
  it("concede exatamente 100 pontos, todos com razões, ignorando score legado", () => {
    const result = evaluateLinkHealth(analysis());
    expect(result.healthScore).toBe(100);
    expect(result.checks.map((c) => c.points)).toEqual([
      20, 25, 15, 15, 10, 5, 10,
    ]);
    expect(
      result.checks.every((c) => c.status === "pass" && c.reason.length > 10),
    ).toBe(true);
    expect(result.healthScore).toBe(
      result.checks.reduce((sum, c) => sum + c.points, 0),
    );
    expect(result.problems).toEqual([]);
    expect(result.warnings).toEqual([]);
    expect(result.availability).toBe("available");
    expect(result.scope).toContain("não garantem segurança");
  });
  it.each([200, 201, 204, 206, 299])(
    "aceita status %s como sucesso técnico",
    (httpStatus) => {
      expect(evaluateLinkHealth(analysis({ httpStatus })).healthScore).toBe(
        100,
      );
    },
  );
  it.each([300, 304, 400, 401, 403, 404, 429, 500, 503])(
    "não confunde resposta HTTP %s com disponibilidade confirmada",
    (httpStatus) => {
      const result = evaluateLinkHealth(analysis({ httpStatus }));
      expect(result.healthScore).toBe(65);
      expect(result.availability).toBe("not-confirmed");
      expect(result.problems.map((p) => p.code)).toEqual([
        "httpStatus",
        "availability",
      ]);
    },
  );
  it.each([
    [0, 100],
    [2000, 100],
    [2001, 85],
  ])("limite de tempo %s ms: score %s", (responseTimeMs, score) => {
    const result = evaluateLinkHealth(analysis({ responseTimeMs }));
    expect(result.healthScore).toBe(score);
    expect(check(result, "responseTime").reason).toContain("2000 ms");
  });
  it.each([
    [0, 100],
    [2, 100],
    [3, 85],
    [5, 85],
  ])("limite de redirects %s: score %s", (redirectCount, score) => {
    expect(evaluateLinkHealth(analysis({ redirectCount })).healthScore).toBe(
      score,
    );
  });
  it("nega pontos HTTPS a um trecho HTTP mesmo com destino HTTPS", () => {
    const result = evaluateLinkHealth(
      analysis({
        redirectCount: 2,
        redirectChain: [
          {
            url: "https://example.com/",
            status: 302,
            destination: "http://example.com/next",
          },
          {
            url: "http://example.com/next",
            status: 301,
            destination: "https://example.com/final",
          },
        ],
      }),
    );
    expect(result.healthScore).toBe(80);
    expect(check(result, "https").status).toBe("fail");
  });
  it("nega HTTPS à URL inicial HTTP", () => {
    expect(
      evaluateLinkHealth(analysis({ protocol: "http", https: false }))
        .healthScore,
    ).toBe(80);
  });
  it("tracking reduz apenas os pontos desse check, sem remover parâmetros", () => {
    const input = analysis({
      tracking: [{ name: "gclid", value: "value", reason: "Google" }],
      unknownParameters: [
        { name: "signature", value: "secret", reason: "Preservar" },
      ],
    });
    const before = structuredClone(input);
    const result = evaluateLinkHealth(input);
    expect(result.healthScore).toBe(95);
    expect(input).toEqual(before);
    expect(result.measurements.unknownParameters).toEqual(
      before.unknownParameters,
    );
    expect(result.warnings.map((p) => p.code)).toEqual([
      "tracking",
      "UNKNOWN_PARAMETERS",
    ]);
  });
  it.each(["blocked", "failed", "skipped"] as const)(
    "checks inconclusivos não recebem pontos: %s",
    (networkStatus) => {
      const result = evaluateLinkHealth(
        analysis({ networkStatus, httpStatus: null, finalDestination: null }),
      );
      expect(result.healthScore).toBe(15); // Only the observed structure and query.
      expect(result.availability).toBe("not-checked");
      expect(result.checks.filter((c) => c.status === "unknown")).toHaveLength(
        5,
      );
      expect(
        result.checks
          .filter((c) => c.status === "unknown")
          .every((c) => c.points === 0 && c.reason.includes("inconclusivo")),
      ).toBe(true);
    },
  );
  it("não pontua HTTP 200 parcial quando a leitura atingiu o limite", () => {
    const result = evaluateLinkHealth(
      analysis({
        networkStatus: "failed",
        finalDestination: null,
        issues: [
          {
            code: "RESPONSE_TOO_LARGE",
            severity: "error",
            message: "Limite atingido",
            recommendation: "Inspeção incompleta",
            penalty: 50,
          },
        ],
      }),
    );
    expect(result.healthScore).toBe(15);
    expect(check(result, "httpStatus").status).toBe("unknown");
    expect(result.measurements.httpStatus).toBe(200);
    expect(result.problems[0].code).toBe("RESPONSE_TOO_LARGE");
  });
  it("URL inválida recebe zero com motivos", () => {
    const result = evaluateLinkHealth(
      analysis({
        valid: false,
        networkStatus: "skipped",
        httpStatus: null,
        finalDestination: null,
      }),
    );
    expect(result.healthScore).toBe(0);
    expect(check(result, "urlStructure").status).toBe("fail");
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(new Set(result.recommendations).size).toBe(
      result.recommendations.length,
    );
  });
  it("configuração central altera pesos, limites e faixa de status", () => {
    const config: HealthConfig = {
      ...LINK_HEALTH_CONFIG,
      version: "test",
      points: { ...LINK_HEALTH_CONFIG.points, tracking: 20, responseTime: 0 },
      maxAcceptableRedirects: 4,
      maxAcceptableResponseTimeMs: 5000,
      successfulStatus: { min: 200, max: 200 },
    };
    const result = evaluateLinkHealth(
      analysis({ responseTimeMs: 4000, redirectCount: 4, httpStatus: 204 }),
      config,
    );
    expect(result.healthScore).toBe(65);
    expect(result.policyVersion).toBe("test");
    expect(check(result, "tracking").points).toBe(20);
    expect(check(result, "responseTime").status).toBe("pass");
    expect(check(result, "redirects").status).toBe("pass");
    expect(check(result, "httpStatus").status).toBe("fail");
  });
  it.each([
    { points: { ...LINK_HEALTH_CONFIG.points, https: 21 } },
    { points: { ...LINK_HEALTH_CONFIG.points, https: -1, tracking: 26 } },
    { points: { ...LINK_HEALTH_CONFIG.points, https: NaN } },
    { maxAcceptableRedirects: -1 },
    { maxAcceptableRedirects: 0.5 },
    { maxAcceptableResponseTimeMs: Infinity },
    { maxAcceptableResponseTimeMs: -1 },
    { successfulStatus: { min: 200, max: 500 } },
    { successfulStatus: { min: 299, max: 200 } },
    { version: "" },
  ])("rejeita configuração inválida %j", (override) => {
    expect(() =>
      evaluateLinkHealth(analysis(), { ...LINK_HEALTH_CONFIG, ...override }),
    ).toThrow("Configuração Link Health inválida");
  });
  it("mostra score, razões, problemas, avisos, recomendações e destinos sem afirmação de segurança", () => {
    const result = evaluateLinkHealth(
      analysis({
        httpStatus: 404,
        redirectCount: 1,
        redirectChain: [
          {
            url: "https://example.com/",
            status: 302,
            destination: "https://example.com/final",
          },
        ],
      }),
    );
    const html = renderToStaticMarkup(
      createElement(HealthResult, { report: result }),
    );
    for (const text of [
      "Health Score",
      "Problemas",
      "Avisos",
      "Recomendações",
      "Redirect chain",
      "Final destination",
      "HTTP 404",
      "+20/20",
    ])
      expect(html).toContain(text);
    expect(html.toLowerCase()).not.toContain("link seguro");
    expect(html).toContain("não garantem segurança");
    expect(html).not.toContain('href="https://example.com');
  });
});

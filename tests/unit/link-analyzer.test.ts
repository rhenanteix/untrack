import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ network: vi.fn() }));
vi.mock("@/modules/link-analyzer/network", () => ({
  inspectNetwork: mocks.network,
}));
import { analyzeLink } from "@/modules/link-analyzer/analyze";

beforeEach(() => {
  mocks.network.mockReset().mockImplementation(async (url: URL) => ({
    status: "completed",
    httpStatus: 200,
    redirectChain: [],
    redirectCount: 0,
    finalDestination: url.href,
  }));
});

describe("Link Analyzer", () => {
  it("expõe componentes, domínio registrável e preserva duplicatas e valores", async () => {
    const url =
      "https://shop.example.com.br:8443/a%20b?q=hello+world&custom=1&custom=2&utm_source=a#section";
    const result = await analyzeLink(url);
    expect(result).toMatchObject({
      valid: true,
      normalizedUrl: url,
      protocol: "https",
      hostname: "shop.example.com.br",
      domain: "example.com.br",
      path: "/a%20b",
      fragment: "section",
      https: true,
      httpStatus: 200,
      networkStatus: "completed",
      healthScore: 90,
    });
    expect(result.query).toBe(new URL(url).search.slice(1));
    expect(result.functionalParameters[0]).toMatchObject({
      name: "q",
      value: "hello world",
    });
    expect(result.unknownParameters.map((p) => p.value)).toEqual(["1", "2"]);
    expect(result.tracking[0].reason).toContain("utm");
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });
  it.each([
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_term",
    "utm_content",
    "gclid",
    "dclid",
    "gbraid",
    "wbraid",
    "fbclid",
    "msclkid",
    "ttclid",
    "twclid",
    "mc_cid",
    "mc_eid",
    "_ga",
    "_gl",
  ])("reconhece tracking %s", async (name) => {
    const result = await analyzeLink(
      `https://example.com/?${name.toUpperCase()}=value`,
    );
    expect(result.tracking).toHaveLength(1);
    expect(result.unknownParameters).toEqual([]);
  });
  it.each(["", "not a url", "https://", "x".repeat(4097)])(
    "reporta URL inválida sem rede: %.30s",
    async (input) => {
      expect(await analyzeLink(input)).toMatchObject({
        valid: false,
        healthScore: 0,
        networkStatus: "skipped",
      });
      expect(mocks.network).not.toHaveBeenCalled();
    },
  );
  it.each([
    "file:///etc/passwd",
    "javascript:alert(1)",
    "data:text/plain,x",
    "ftp://example.com/",
    "https://user:password@example.com",
  ])("recusa protocolo/credenciais: %s", async (input) => {
    expect(await analyzeLink(input)).toMatchObject({
      valid: false,
      healthScore: 0,
    });
    expect(mocks.network).not.toHaveBeenCalled();
  });
  it.each([
    ["https://a.example.co.uk", "example.co.uk"],
    ["https://tenant.github.io", "tenant.github.io"],
    ["https://8.8.8.8", null],
    ["https://[2606:4700:4700::1111]", null],
  ])("identifica domínio de %s", async (input, domain) => {
    expect((await analyzeLink(input!)).domain).toBe(domain);
  });
  it("não penaliza parâmetros desconhecidos nem altera o link", async () => {
    const input = "https://example.com/?signature=ABC%2f&signature=&PAGE=2";
    const result = await analyzeLink(input);
    expect(result.normalizedUrl).toBe(input);
    expect(result.healthScore).toBe(100);
    expect(result.unknownParameters).toHaveLength(3);
    expect(result.recommendations.join()).toContain("Preserve");
  });
  it("explica cada desconto e limita a pontuação a zero", async () => {
    mocks.network.mockResolvedValue({
      status: "blocked",
      httpStatus: 302,
      redirectCount: 1,
      redirectChain: [
        {
          url: "https://example.com",
          status: 302,
          destination: "http://localhost",
        },
      ],
      finalDestination: null,
      error: { code: "UNSAFE_URL", message: "Bloqueado" },
    });
    const result = await analyzeLink("http://example.com?gclid=1");
    expect(result.healthScore).toBe(0);
    expect(result.issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        "UNSAFE_URL",
        "HTTPS_DOWNGRADE",
        "REDIRECTS",
        "HTTP_NOT_SECURE",
        "TRACKING_PARAMETERS",
      ]),
    );
    expect(result.issues.every((i) => i.message && i.recommendation)).toBe(
      true,
    );
  });
  it.each([404, 500])("reporta HTTP %s como problema", async (status) => {
    mocks.network.mockResolvedValue({
      status: "completed",
      httpStatus: status,
      redirectCount: 0,
      redirectChain: [],
      finalDestination: "https://example.com/",
    });
    const result = await analyzeLink("https://example.com");
    expect(result.healthScore).toBe(60);
    expect(result.issues[0].code).toBe("HTTP_ERROR");
  });
  it("distingue falha de rede de URL inválida", async () => {
    mocks.network.mockResolvedValue({
      status: "failed",
      httpStatus: null,
      redirectCount: 0,
      redirectChain: [],
      finalDestination: null,
      error: { code: "TIMEOUT", message: "Timeout" },
    });
    expect(await analyzeLink("https://example.com")).toMatchObject({
      valid: true,
      networkStatus: "failed",
      finalDestination: null,
      healthScore: 50,
    });
  });
});

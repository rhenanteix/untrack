import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { track } from "@/lib/analytics";
import { POST as analyze } from "@/app/api/links/analyze/route";
import { POST as clean } from "@/app/api/links/clean/route";
import { POST as utm } from "@/app/api/utm/generate/route";
import { POST as qr } from "@/app/api/qr/generate/route";
import { POST as analytics } from "@/app/api/analytics/route";

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/analytics", () => ({
  track: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (callback: () => unknown) => callback(),
}));

function request(body: unknown) {
  return new Request("http://localhost:3000/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceRateLimit).mockResolvedValue({
    "X-RateLimit-Remaining": "99",
  });
});

describe("contratos das APIs V1", () => {
  it("limpa pela API principal e pelo alias, com estatísticas e rate limit", async () => {
    for (const handler of [analyze, clean]) {
      const response = await handler(
        request({ url: "https://example.com/?utm_source=x&id=7" }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("X-RateLimit-Remaining")).toBe("99");
      expect(await response.json()).toMatchObject({
        cleanUrl: "https://example.com/?id=7",
        statistics: { trackingParameters: 1, preservedParameters: 1 },
      });
    }
  });

  it("gera UTMs e QR Code em PNG", async () => {
    const response = await utm(
      request({
        url: "https://example.com/?id=7",
        source: "news",
        medium: "email",
        campaign: "v1",
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).url).toContain(
      "id=7&utm_source=news&utm_medium=email&utm_campaign=v1",
    );
    const image = await qr(
      request({ url: "https://example.com/", format: "png" }),
    );
    expect(image.headers.get("Content-Type")).toBe("image/png");
    expect([...new Uint8Array(await image.arrayBuffer()).slice(0, 4)]).toEqual([
      137, 80, 78, 71,
    ]);
  });

  it.each([analyze, utm, qr, analytics])(
    "rejeita JSON, formato e entrada inválidos",
    async (handler) => {
      expect((await handler(request({}))).status).toBe(400);
      const malformed = new Request("http://localhost/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      });
      expect(await (await handler(malformed)).json()).toMatchObject({
        code: "INVALID_JSON",
      });
      const plain = new Request("http://localhost/api", {
        method: "POST",
        body: "hello",
      });
      expect((await handler(plain)).status).toBe(415);
    },
  );

  it("preserva a resposta de rate limit", async () => {
    vi.mocked(enforceRateLimit).mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "Tente novamente."),
    );
    expect(
      (await analyze(request({ url: "https://example.com" }))).status,
    ).toBe(429);
  });
});

describe("coleta de analytics", () => {
  it("encaminha eventos do navegador ao sink sem dados do link", async () => {
    const response = await analytics(
      request({ event: "link_copied", path: "/limpar-link" }),
    );
    expect(response.status).toBe(204);
    expect(track).toHaveBeenCalledExactlyOnceWith("link_copied", {
      path: "/limpar-link",
      authenticated: false,
    });
  });

  it.each([
    { event: "page_view", path: "/gerar-qrcode?url=https://private.example" },
    { event: "page_view", path: "/", url: "https://private.example" },
    { event: "qr_generated", path: "/gerar-qrcode" },
    { event: "unknown", path: "/" },
  ])(
    "rejeita dados privados, eventos desconhecidos e eventos já registrados no servidor",
    async (body) => {
      expect((await analytics(request(body))).status).toBe(400);
      expect(track).not.toHaveBeenCalled();
    },
  );
});

vi.mock("@/lib/anonymous-use", () => ({ withAnonymousUse: (_request: Request, action: () => Promise<Response>) => action() }));

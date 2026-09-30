import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ analyze: vi.fn(), rate: vi.fn() }));
vi.mock("@/modules/link-health/service", () => ({
  checkLinkHealth: mocks.analyze,
}));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.rate }));
import { POST } from "@/app/api/link-health/route";
import { ApiError } from "@/lib/api-response";
const request = (body: unknown) =>
  new Request("http://localhost/api/link-health", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  mocks.analyze
    .mockReset()
    .mockResolvedValue({ valid: true, healthScore: 100 });
  mocks.rate.mockReset().mockResolvedValue({ "X-RateLimit-Remaining": "99" });
});
it("retorna análise sem cache e com rate limit", async () => {
  const response = await POST(request({ url: "https://example.com" }));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    health: { valid: true, healthScore: 100 },
  });
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-ratelimit-remaining")).toBe("99");
  expect(mocks.rate).toHaveBeenCalledWith(expect.any(Request), "link-health");
});
it.each([{}, { url: 123 }, { url: "x".repeat(4097) }, null])(
  "rejeita payload inválido %j",
  async (body) => {
    expect((await POST(request(body))).status).toBe(400);
    expect(mocks.analyze).not.toHaveBeenCalled();
  },
);
it("aceita sintaxe de URL inválida para análise explicável", async () => {
  expect((await POST(request({ url: "invalid" }))).status).toBe(200);
  expect(mocks.analyze).toHaveBeenCalledWith("invalid");
});
it("rejeita JSON malformado", async () => {
  const response = await POST(
    new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    }),
  );
  expect(response.status).toBe(400);
});
it("rejeita mídia não JSON", async () => {
  expect(
    (
      await POST(
        new Request("http://localhost", { method: "POST", body: "text" }),
      )
    ).status,
  ).toBe(415);
});
it.each([429, 503])("respeita bloqueio do rate limiter: %s", async (status) => {
  mocks.rate.mockRejectedValue(
    new ApiError(status, "RATE_LIMITED", "Indisponível"),
  );
  expect((await POST(request({ url: "https://example.com" }))).status).toBe(
    status,
  );
  expect(mocks.analyze).not.toHaveBeenCalled();
});

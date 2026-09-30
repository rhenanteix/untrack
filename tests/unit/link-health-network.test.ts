import { EventEmitter } from "node:events";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: mocks.lookup }));
vi.mock("node:http", () => ({ default: { request: mocks.request } }));
vi.mock("node:https", () => ({ default: { request: mocks.request } }));
import { checkLinkHealth } from "@/modules/link-health/service";
import { NETWORK_LIMITS } from "@/modules/link-analyzer/network";
beforeEach(() => {
  mocks.lookup
    .mockReset()
    .mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  mocks.request.mockReset();
});
afterEach(() => vi.useRealTimers());
it.each([
  "http://localhost",
  "http://127.0.0.1",
  "http://10.0.0.1",
  "http://169.254.169.254",
  "http://[::1]",
])("Link Health mantém bloqueio SSRF de %s", async (url) => {
  const report = await checkLinkHealth(url);
  expect(report.measurements.networkStatus).toBe("blocked");
  expect(report.problems.some((p) => p.code === "UNSAFE_URL")).toBe(true);
  expect(report.availability).toBe("not-checked");
  expect(mocks.request).not.toHaveBeenCalled();
});
it.each([
  "file:///etc/passwd",
  "javascript:alert(1)",
  "data:text/plain,x",
  "ftp://example.com",
])("recusa %s sem rede", async (url) => {
  const report = await checkLinkHealth(url);
  expect(report.healthScore).toBe(0);
  expect(mocks.lookup).not.toHaveBeenCalled();
  expect(mocks.request).not.toHaveBeenCalled();
});
it("DNS misto não passa a barreira SSRF", async () => {
  mocks.lookup.mockResolvedValue([
    { address: "93.184.216.34", family: 4 },
    { address: "192.168.1.1", family: 4 },
  ]);
  expect(
    (await checkLinkHealth("https://example.com")).measurements.networkStatus,
  ).toBe("blocked");
  expect(mocks.request).not.toHaveBeenCalled();
});
it("timeout DNS é reportado sem conceder pontos de rede", async () => {
  vi.useFakeTimers();
  mocks.lookup.mockReturnValue(new Promise(() => {}));
  const pending = checkLinkHealth("https://example.com");
  await vi.advanceTimersByTimeAsync(NETWORK_LIMITS.timeoutMs);
  const report = await pending;
  expect(report.healthScore).toBe(15);
  expect(report.problems.some((p) => p.code === "TIMEOUT")).toBe(true);
  expect(mocks.request).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});
it("redirect para metadata é registrado e bloqueado antes do segundo acesso", async () => {
  mocks.request.mockImplementation(
    (_options: unknown, callback: (response: EventEmitter) => void) => {
      const request = Object.assign(new EventEmitter(), {
        end: () =>
          callback(
            Object.assign(new EventEmitter(), {
              statusCode: 302,
              headers: { location: "http://169.254.169.254" },
              destroy: vi.fn(),
            }),
          ),
      });
      return request;
    },
  );
  const report = await checkLinkHealth("https://example.com");
  expect(report.measurements.networkStatus).toBe("blocked");
  expect(report.measurements.redirectChain).toHaveLength(1);
  expect(report.measurements.finalDestination).toBeNull();
  expect(report.checks.find((c) => c.id === "https")?.points).toBe(0);
  expect(mocks.request).toHaveBeenCalledTimes(1);
});

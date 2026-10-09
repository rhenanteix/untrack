import { randomUUID } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { ConnectSource } from "@prisma/client";
vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/modules/connect/ingestion", () => ({ ingestEvent: vi.fn() }));
import { ingestEvent } from "@/modules/connect/ingestion";
import { receiveEvent } from "@/modules/connect/http";
const ingest = vi.mocked(ingestEvent);
const source = {
  id: "source",
  workspaceId: "resolved-on-server",
} as ConnectSource;
const request = (body: string, headers: Record<string, string> = {}) =>
  new Request("https://linkor.test/api/connect/events", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body,
  });
describe("Connect HTTP boundary", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => {});
    ingest.mockReset();
  });
  afterEach(() => vi.restoreAllMocks());
  it("does not acknowledge a failed durable write", async () => {
    ingest.mockRejectedValue(new Error("secret database error"));
    const response = await receiveEvent(request("{}"), source);
    expect(response.status).toBe(503);
    expect(response.headers.get("Retry-After")).toBe("5");
    expect(await response.text()).not.toContain("secret");
  });
  it("enforces streamed payload size even without Content-Length", async () => {
    const response = await receiveEvent(
      request(JSON.stringify({ data: "x".repeat(17000) })),
      source,
    );
    expect(response.status).toBe(413);
    expect(ingest).not.toHaveBeenCalled();
  });
  it("rejects malformed JSON before ingestion", async () => {
    expect((await receiveEvent(request("{"), source)).status).toBe(400);
    expect(ingest).not.toHaveBeenCalled();
  });
  it.each([
    [false, "queued", false, 202],
    [true, "normalized", false, 200],
    [false, "rejected", false, 422],
    [false, "queued", true, 409],
  ] as const)(
    "maps receipt status %s %s %s",
    async (duplicate, state, conflict, status) => {
      ingest.mockResolvedValue({
        receiptId: randomUUID(),
        correlationId: randomUUID(),
        state,
        duplicate,
        conflict,
        errorCode: null,
      });
      const response = await receiveEvent(
        request("{}", { "Sec-GPC": "1" }),
        source,
      );
      expect(response.status).toBe(status);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(ingest).toHaveBeenCalledWith(
        source,
        {},
        expect.objectContaining({ privacyDenied: true }),
      );
    },
  );
});

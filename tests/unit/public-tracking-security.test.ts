import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/smart-pages/events/route";
import { enforceRateLimit } from "@/lib/rate-limit";
import { recordPublicSmartPageEvent } from "@/modules/smart-pages/events";

vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/request-origin", () => ({ enforceSameOrigin: vi.fn() }));
vi.mock("@/modules/smart-pages/events", () => ({
  publicSmartPageEventNames: ["smart_page_view"],
  recordPublicSmartPageEvent: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(enforceRateLimit).mockResolvedValue({});
});

describe("public event tenancy", () => {
  it("rejects a client-selected workspace before resolving the public asset", async () => {
    const response = await POST(
      new Request("http://localhost:3000/api/smart-pages/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "smart_page_view",
          eventId: "8d71a6c0-d3a5-42d4-ae7e-383a0ad15ef6",
          slug: "minha-pagina",
          workspaceId: "workspace_b",
        }),
      }),
    );

    expect(response.status).toBe(400);
    expect(recordPublicSmartPageEvent).not.toHaveBeenCalled();
  });
});
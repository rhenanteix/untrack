import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  createMany: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ sessionFromHeaders: mocks.session }));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    anonymousUse: {
      createMany: mocks.createMany,
      deleteMany: mocks.deleteMany,
    },
  }),
}));
import { withAnonymousUse } from "@/lib/anonymous-use";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(null);
  mocks.createMany.mockResolvedValue({ count: 2 });
  mocks.deleteMany.mockResolvedValue({ count: 2 });
  vi.stubEnv("BETTER_AUTH_SECRET", "test-only-secret-at-least-32-characters");
});
const request = () =>
  new Request("http://localhost/api", {
    headers: { "x-real-ip": "198.18.0.1" },
  });
describe("shared anonymous allowance", () => {
  it("stores only keyed hashes and returns an HttpOnly identifier", async () => {
    const response = await withAnonymousUse(request(), async () =>
      Response.json({ ok: true }),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(mocks.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(JSON.stringify(mocks.createMany.mock.calls)).not.toContain(
      "198.18.0.1",
    );
  });
  it("requires login on an atomic uniqueness conflict without running the action", async () => {
    mocks.createMany.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6",
      }),
    );
    const action = vi.fn();
    const response = await withAnonymousUse(request(), action);
    expect(response.status).toBe(401);
    expect(action).not.toHaveBeenCalled();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
  it("returns failed attempts to the allowance", async () => {
    const response = await withAnonymousUse(request(), async () =>
      Response.json({ error: "invalid" }, { status: 400 }),
    );
    expect(response.status).toBe(400);
    expect(mocks.deleteMany).toHaveBeenCalledOnce();
  });
  it("does not impose visitor allowance on authenticated users", async () => {
    mocks.session.mockResolvedValue({ user: { id: "member" } });
    expect(
      (
        await withAnonymousUse(request(), async () =>
          Response.json({ ok: true }),
        )
      ).status,
    ).toBe(200);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});

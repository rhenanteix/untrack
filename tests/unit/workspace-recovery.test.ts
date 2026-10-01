import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-response";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { safeReturnPath } from "@/modules/auth/return-path";
const mocks = vi.hoisted(() => ({ upsert: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    workspace: { upsert: mocks.upsert },
    workspaceMember: { findUnique: mocks.findUnique },
  }),
}));
import { actorFor } from "@/modules/workspaces/context";
beforeEach(() => {
  mocks.upsert.mockReset().mockResolvedValue({ id: "personal:user-a" });
  mocks.findUnique.mockReset().mockResolvedValue({ role: "owner" });
});

describe("workspace recovery", () => {
  it("does not disguise a missing database column as an invalid workspace cookie", async () => {
    const error = { code: "P2022", message: "column missing" };
    mocks.upsert.mockRejectedValue(error);
    await expect(actorFor("user-a", new Headers())).rejects.toBe(error);
    expect(workspaceLoadError(error).code).toBe("DATABASE_SCHEMA_OUTDATED");
  });
  it.each(["P2021", "P2022"])(
    "classifies schema error %s without exposing SQL",
    (code) => {
      const message = workspaceLoadError({
        code,
        message: "password=private sql=select...",
      });
      expect(message.code).toBe("DATABASE_SCHEMA_OUTDATED");
      expect(JSON.stringify(message)).not.toContain("private");
      expect(JSON.stringify(message)).not.toContain("select...");
    },
  );
  it.each(["P1000", "P1001", "P1002", "P1017"])(
    "classifies unavailable database %s",
    (code) => {
      expect(workspaceLoadError({ code }).code).toBe("DATABASE_UNAVAILABLE");
    },
  );
  it("rejects malformed cookie without attempting a DB query", async () => {
    await expect(
      actorFor("user-a", new Headers({ cookie: "untrack.workspace=%ZZ" })),
    ).rejects.toMatchObject({ code: "INVALID_WORKSPACE" });
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });
  it("does not silently move a request to a personal workspace after access was revoked", async () => {
    mocks.findUnique.mockResolvedValue(null);
    await expect(
      actorFor(
        "user-a",
        new Headers({ cookie: "untrack.workspace=workspace-b" }),
      ),
    ).rejects.toMatchObject({ code: "WORKSPACE_FORBIDDEN" });
    expect(mocks.findUnique).toHaveBeenCalledWith({
      where: {
        workspaceId_userId: { workspaceId: "workspace-b", userId: "user-a" },
      },
    });
    expect(mocks.upsert).not.toHaveBeenCalled();
    expect(
      workspaceLoadError(new ApiError(403, "WORKSPACE_FORBIDDEN", "internal"))
        .title,
    ).toBe("Selecione outro workspace");
  });
  it("preserves the authenticated return to Smart Pages without accepting external URLs", () => {
    expect(safeReturnPath("/untrack/smart-pages")).toBe("/untrack/smart-pages");
    expect(safeReturnPath("//evil.example/untrack")).toBe("/conta");
    expect(safeReturnPath("/untracked")).toBe("/conta");
  });
});

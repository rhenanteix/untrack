import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { listSmartPageFormOverviews } from "@/modules/smart-pages/forms";
import type { Actor } from "@/modules/workspaces/context";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

const actor: Actor = {
  userId: "user_1",
  workspaceId: "workspace_1",
  role: "owner",
};

describe("Smart Page form overviews", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("aggregates form events and unique contacts within the actor workspace", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "form_1",
        name: "Lista de espera",
        title: "Entre na lista",
        status: "active",
        createdAt: new Date("2026-10-04T10:00:00Z"),
        updatedAt: new Date("2026-10-05T10:00:00Z"),
        smartPage: { id: "page_1", title: "Aurora", slug: "aurora" },
      },
    ]);
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([
        { elementId: "form_1", name: "form_view", _count: { _all: 20 } },
        { elementId: "form_1", name: "form_submit", _count: { _all: 5 } },
        {
          elementId: "form_1",
          name: "lead_created",
          _count: { _all: 3 },
        },
      ])
      .mockResolvedValueOnce([
        { formId: "form_1", contactId: "contact_1" },
        { formId: "form_1", contactId: "contact_2" },
      ]);
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findMany },
      analyticsEvent: { groupBy },
      smartPageFormSubmission: { groupBy },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(listSmartPageFormOverviews(actor)).resolves.toEqual([
      expect.objectContaining({
        id: "form_1",
        views: 20,
        submissions: 5,
        contacts: 2,
        leads: 3,
        submissionRate: 25,
      }),
    ]);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { workspaceId: "workspace_1" } }),
    );
    expect(groupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ workspaceId: "workspace_1" }),
      }),
    );
  });
});

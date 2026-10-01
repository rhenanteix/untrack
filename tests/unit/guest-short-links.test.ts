import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  userUpsert: vi.fn(),
  workspaceUpsert: vi.fn(),
  memberUpsert: vi.fn(),
  shortLinkCreate: vi.fn(),
}));

vi.mock("@/lib/app-url", () => ({
  appUrl: () => new URL("http://localhost:3000"),
}));
vi.mock("@/lib/prisma", () => ({
  getPrisma: () => ({
    $transaction: mocks.transaction,
    shortLink: { create: mocks.shortLinkCreate },
  }),
}));

import { createGuestShortLink } from "@/modules/short-links/guest-service";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.transaction.mockImplementation(async (action) =>
    action({
      user: { upsert: mocks.userUpsert },
      workspace: { upsert: mocks.workspaceUpsert },
      workspaceMember: { upsert: mocks.memberUpsert },
    }),
  );
  mocks.shortLinkCreate.mockResolvedValue({ id: "link-1", slug: "guest-link" });
});

describe("anonymous Short Links", () => {
  it("cria o primeiro link em um workspace técnico isolado", async () => {
    await createGuestShortLink({
      url: "https://example.com/oferta",
      title: "Oferta",
      description: "Campanha pública",
    });

    expect(mocks.userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "untrack-guest-user" } }),
    );
    expect(mocks.workspaceUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "untrack-guest-workspace" } }),
    );
    expect(mocks.memberUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          workspaceId_userId: {
            workspaceId: "untrack-guest-workspace",
            userId: "untrack-guest-user",
          },
        },
      }),
    );
    expect(mocks.shortLinkCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "untrack-guest-user",
          workspaceId: "untrack-guest-workspace",
          destinationUrl: "https://example.com/oferta",
        }),
      }),
    );
  });

  it("recusa usar um redirect da plataforma como destino", async () => {
    await expect(
      createGuestShortLink({ url: "http://localhost:3000/s/outro-link" }),
    ).rejects.toMatchObject({ code: "NESTED_SHORT_LINK" });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.shortLinkCreate).not.toHaveBeenCalled();
  });
});

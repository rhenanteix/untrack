import { describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { getAudienceContact } from "@/modules/audience/service";
import type { Actor } from "@/modules/workspaces/context";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));

describe("Audience contact timeline", () => {
  it("keeps the real form identification in the timeline when analytics is unavailable", async () => {
    const submittedAt = new Date("2026-10-05T14:24:00.000Z");
    vi.mocked(getPrisma).mockReturnValue({
      audienceContact: {
        findFirst: vi.fn().mockResolvedValue({
          id: "contact_1",
          creationSource: "form",
          analyticsVisitors: [],
          notes: [],
          exchanges: [],
          formSubmissions: [
            {
              id: "submission_1",
              source: "instagram",
              campaignAssetId: "distribution_1",
              submittedAt,
              form: { id: "form_1", name: "Quero saber mais" },
              smartPage: { id: "page_1", title: "Produto", slug: "produto" },
              campaign: { id: "campaign_1", name: "Lançamento" },
            },
          ],
          events: [
            {
              id: "contact_form_event",
              name: "form_submitted",
              occurredAt: submittedAt,
              metadata: {},
            },
            {
              id: "contact_lead_event",
              name: "lead_created",
              occurredAt: submittedAt,
              metadata: { submissionId: "submission_1", source: "instagram" },
            },
          ],
        }),
      },
      analyticsEvent: { findMany: vi.fn().mockResolvedValue([]) },
      analyticsConversion: { findMany: vi.fn().mockResolvedValue([]) },
      campaignAsset: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "distribution_1",
            name: "Instagram Bio",
            campaign: { name: "Lançamento" },
            channel: { name: "Instagram" },
          },
        ]),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    const contact = await getAudienceContact(
      { workspaceId: "workspace_1" } as Actor,
      "contact_1",
    );

    expect(contact.timeline).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "submission:submission_1",
          name: "form_submitted",
          context: expect.objectContaining({
            source: "instagram",
            smartPage: "Produto",
            form: "Quero saber mais",
            campaign: "Lançamento",
          }),
        }),
        expect.objectContaining({
          id: "contact:contact_lead_event",
          name: "lead_created",
          context: expect.objectContaining({
            smartPage: "Produto",
            form: "Quero saber mais",
          }),
        }),
      ]),
    );
    expect(contact.timeline.map((item) => item.id)).not.toContain(
      "contact:contact_form_event",
    );
    expect(contact.attribution).toMatchObject({
      firstCampaign: "Lançamento",
      firstDistribution: { name: "Instagram Bio" },
      landingAsset: "Produto",
      identifiedVia: "form",
    });
  });

  it("does not expose a contact outside the active workspace", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    vi.mocked(getPrisma).mockReturnValue({
      audienceContact: { findFirst },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      getAudienceContact(
        { workspaceId: "workspace_a" } as Actor,
        "contact_from_workspace_b",
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "AUDIENCE_CONTACT_NOT_FOUND",
    });
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contact_from_workspace_b", workspaceId: "workspace_a" },
      }),
    );
  });
});
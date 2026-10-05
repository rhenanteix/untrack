import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
} from "@/modules/analytics/public-context";
import { submitPublicSmartPageForm } from "@/modules/smart-pages/forms";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/modules/analytics/aggregation", () => ({
  aggregateAnalyticsEvent: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/audience/summary", () => ({
  refreshAudienceContactSummary: vi.fn().mockResolvedValue(undefined),
}));

const form = {
  id: "form_1",
  workspaceId: "workspace_1",
  smartPageId: "page_1",
  smartPageBlockId: "block_1",
  successMessage: "Recebemos seu interesse.",
  fields: [
    {
      id: "field_name",
      fieldType: "name",
      label: "Nome",
      required: true,
      options: [],
    },
    {
      id: "field_email",
      fieldType: "email",
      label: "E-mail",
      required: true,
      options: [],
    },
    {
      id: "field_phone",
      fieldType: "phone",
      label: "WhatsApp",
      required: false,
      options: [],
    },
    {
      id: "field_consent",
      fieldType: "consent",
      label: "Aceito receber contato do LinkOr.",
      required: true,
      options: [],
    },
  ],
  smartPage: { id: "page_1", slug: "linkor-demo", workspaceId: "workspace_1" },
  smartPageBlock: { id: "block_1", analyticsEnabled: true },
};

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "golden-path-test-secret");
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("LinkOr Golden Path V1", () => {
  it("attributes a LinkedIn form lead to its campaign distribution and converts the primary Goal", async () => {
    const contacts: Array<Record<string, unknown>> = [];
    const submissions: Array<Record<string, unknown>> = [];
    const events: Array<Record<string, unknown>> = [];
    const conversions: Array<Record<string, unknown>> = [];
    let visitor: Record<string, unknown> | undefined;
    let session: Record<string, unknown> | undefined;

    const tx = {
      smartPageFormSubmission: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }) => {
          const submission = { id: "submission_1", ...data };
          submissions.push(submission);
          return submission;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      audienceContact: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(async ({ data }) => {
          const contact = { id: "contact_1", ...data };
          contacts.push(contact);
          return contact;
        }),
      },
      audienceContactEvent: { create: vi.fn().mockResolvedValue({}) },
      analyticsVisitor: {
        upsert: vi.fn(async ({ create, update }) => {
          visitor = visitor ? { ...visitor, ...update } : { id: "visitor_1", ...create };
          return visitor;
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      analyticsSession: {
        findFirst: vi.fn(async () => session ?? null),
        create: vi.fn(async ({ data }) => {
          session = { id: "session_1", ...data };
          return session;
        }),
        update: vi.fn(async ({ data }) => {
          session = { ...session, ...data };
          return session;
        }),
      },
      analyticsEvent: {
        create: vi.fn(async ({ data }) => {
          const event = { id: `event_${events.length + 1}`, ...data };
          events.push(event);
          return event;
        }),
      },
      analyticsGoal: {
        findMany: vi.fn(async ({ where }) =>
          where.eventName === "lead_created"
            ? [
                {
                  id: "goal_lead_captured",
                  workspaceId: "workspace_1",
                  goalType: "LEAD_CREATED",
                  scopeType: "CAMPAIGN",
                  scopeId: "campaign_linkor_golden_path",
                  conditions: { assetType: "smart_page" },
                },
              ]
            : [],
        ),
      },
      analyticsConversion: {
        findUnique: vi.fn(async ({ where }) =>
          conversions.find(
            (conversion) =>
              conversion.goalId === where.goalId_eventId.goalId &&
              conversion.eventId === where.goalId_eventId.eventId,
          ) ?? null,
        ),
        create: vi.fn(async ({ data }) => {
          const conversion = { id: "conversion_1", ...data };
          conversions.push(conversion);
          return conversion;
        }),
      },
    };
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: tx.smartPageFormSubmission,
      campaign: {
        findFirst: vi
          .fn()
          .mockResolvedValue({ id: "campaign_linkor_golden_path" }),
      },
      campaignAsset: {
        findFirst: vi.fn().mockResolvedValue({ id: "distribution_linkedin" }),
      },
      $transaction: vi.fn(async (work) => work(tx)),
    } as unknown as ReturnType<typeof getPrisma>);

    const initialHeaders = new Headers();
    const context = resolvePublicAnalyticsContext(initialHeaders);
    const cookie = publicAnalyticsContextCookies(
      initialHeaders,
      context,
      resolveAttribution({
        ...context.attribution,
        knownContext: {
          source: "linkedin",
          medium: "social",
          channel: "organic_social",
          campaign: "linkor-golden-path",
        },
      }),
      {
        campaignId: "campaign_linkor_golden_path",
        campaignAssetId: "distribution_linkedin",
      },
    )
      .map((value) => value.split(";")[0])
      .join("; ");

    const result = await submitPublicSmartPageForm(
      "linkor-demo",
      "form_1",
      {
        idempotencyKey: "ccbb6fd7-217a-4336-aac2-935c3b21e880",
        values: {
          field_name: "Ana Golden",
          field_email: "ana.golden@example.com",
          field_phone: "+55 11 91234-5678",
          field_consent: true,
        },
      },
      new Headers({ cookie, "user-agent": "Mozilla/5.0 (iPhone) Safari/604.1" }),
    );

    expect(result).toMatchObject({ submitted: true, leadCreated: true });
    expect(contacts).toEqual([
      expect.objectContaining({
        id: "contact_1",
        email: "ana.golden@example.com",
        phone: "+5511912345678",
        firstSource: "linkedin",
        firstCampaign: "linkor-golden-path",
      }),
    ]);
    expect(submissions).toEqual([
      expect.objectContaining({
        contactId: "contact_1",
        campaignId: "campaign_linkor_golden_path",
        campaignAssetId: "distribution_linkedin",
        source: "linkedin",
      }),
    ]);
    expect(events.map((event) => event.name)).toEqual([
      "form_submit",
      "lead_created",
      "goal_completed",
    ]);
    expect(conversions).toEqual([
      expect.objectContaining({
        goalId: "goal_lead_captured",
        visitorId: "visitor_1",
        sessionId: "session_1",
        campaignId: "campaign_linkor_golden_path",
        campaignAssetId: "distribution_linkedin",
        assetType: "smart_page",
        assetId: "page_1",
        source: "linkedin",
      }),
    ]);
    expect(JSON.stringify(events)).not.toContain("ana.golden@example.com");
    expect(JSON.stringify(events)).not.toContain("Ana Golden");
  });
});
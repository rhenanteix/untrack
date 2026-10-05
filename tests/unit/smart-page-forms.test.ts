import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrisma } from "@/lib/prisma";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { submitPublicSmartPageForm } from "@/modules/smart-pages/forms";

vi.mock("@/lib/prisma", () => ({ getPrisma: vi.fn() }));
vi.mock("@/modules/analytics/service", () => ({
  recordAnalyticsEvent: vi.fn(),
}));

const form = {
  id: "form_1",
  workspaceId: "workspace_1",
  smartPageId: "page_1",
  smartPageBlockId: "block_1",
  successMessage: "Recebemos seus dados.",
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
      required: false,
      options: [],
    },
    {
      id: "field_phone",
      fieldType: "phone",
      label: "Telefone",
      required: false,
      options: [],
    },
  ],
  smartPage: { id: "page_1", slug: "minha-pagina", workspaceId: "workspace_1" },
  smartPageBlock: { id: "block_1", analyticsEnabled: true },
};

beforeEach(() => {
  vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-with-enough-entropy");
  vi.mocked(recordAnalyticsEvent).mockResolvedValue({
    eventId: "event_1",
    recorded: true,
    duplicate: false,
    visitorId: "visitor_1",
    sessionId: "session_1",
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("public Smart Page form submissions", () => {
  it("rejects a value for a field outside the persisted form definition", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      submitPublicSmartPageForm(
        "minha-pagina",
        "form_1",
        {
          idempotencyKey: "0ad0e37a-0434-49cf-86bf-36f82ebb9b6a",
          values: {
            field_name: "Maria",
            unexpected: "<script>alert(1)</script>",
          },
        },
        new Headers(),
      ),
    ).rejects.toMatchObject({ code: "UNKNOWN_FORM_FIELD", status: 422 });
  });

  it("requires an actual e-mail or telephone value before creating a contact", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: { findUnique: vi.fn().mockResolvedValue(null) },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      submitPublicSmartPageForm(
        "minha-pagina",
        "form_1",
        {
          idempotencyKey: "a83b3589-75b8-4787-8459-a0d386f99811",
          values: { field_name: "Maria" },
        },
        new Headers(),
      ),
    ).rejects.toMatchObject({ code: "CONTACT_IDENTITY_REQUIRED", status: 422 });
  });

  it("returns success for an idempotent retry without creating another lead", async () => {
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: {
        findUnique: vi
          .fn()
          .mockResolvedValue({ id: "submission_1", contactId: "contact_1" }),
      },
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      submitPublicSmartPageForm(
        "minha-pagina",
        "form_1",
        {
          idempotencyKey: "d901dc37-904f-4c47-849d-da6f1da0f707",
          values: { field_name: "Maria", field_email: "maria@example.com" },
        },
        new Headers(),
      ),
    ).resolves.toMatchObject({
      submitted: true,
      leadCreated: false,
      successMessage: "Recebemos seus dados.",
    });
  });

  it("creates a contact with UTM attribution and keeps PII out of analytics", async () => {
    const captureTx = {
      smartPageFormSubmission: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "submission_1" }),
      },
      audienceContact: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "contact_1" }),
      },
      audienceContactEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const identityTx = {
      smartPageFormSubmission: { update: vi.fn().mockResolvedValue({}) },
      analyticsVisitor: { update: vi.fn().mockResolvedValue({}) },
    };
    const transaction = vi
      .fn()
      .mockImplementationOnce(async (callback) => callback(captureTx))
      .mockImplementationOnce(async (callback) => callback(identityTx));
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: transaction,
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      submitPublicSmartPageForm(
        "minha-pagina",
        "form_1",
        {
          idempotencyKey: "a1e95a76-5848-43de-8b5b-57071aed4a44",
          values: {
            field_name: "Maria Silva",
            field_email: "Maria@Example.com",
          },
          utmSource: "instagram",
          utmMedium: "social",
          utmCampaign: "evento-outubro",
        },
        new Headers(),
      ),
    ).resolves.toMatchObject({ submitted: true, leadCreated: true });

    expect(captureTx.audienceContact.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: "maria@example.com",
          firstSource: "instagram",
          firstCampaign: "evento-outubro",
        }),
      }),
    );
    expect(recordAnalyticsEvent).toHaveBeenCalledTimes(2);
    for (const [event] of vi.mocked(recordAnalyticsEvent).mock.calls) {
      expect(event.name).toMatch(/form_submit|lead_created/);
      expect(JSON.stringify(event)).not.toContain("Maria@Example.com");
      expect(JSON.stringify(event)).not.toContain("maria@example.com");
    }
    expect(identityTx.analyticsVisitor.update).toHaveBeenCalledWith({
      where: { id: "visitor_1" },
      data: { audienceContactId: "contact_1" },
    });
  });

  it("records another submission for an existing e-mail without a new lead", async () => {
    const captureTx = {
      smartPageFormSubmission: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "submission_2" }),
      },
      audienceContact: {
        findFirst: vi.fn().mockResolvedValue({
          id: "contact_1",
          customFields: {},
          firstSource: "instagram",
          firstMedium: "social",
          firstChannel: "organic_social",
          firstCampaign: "evento-setembro",
        }),
        update: vi.fn().mockResolvedValue({ id: "contact_1" }),
        create: vi.fn(),
      },
      audienceContactEvent: { create: vi.fn().mockResolvedValue({}) },
    };
    const identityTx = {
      smartPageFormSubmission: { update: vi.fn().mockResolvedValue({}) },
      analyticsVisitor: { update: vi.fn().mockResolvedValue({}) },
    };
    vi.mocked(getPrisma).mockReturnValue({
      smartPageForm: { findFirst: vi.fn().mockResolvedValue(form) },
      smartPageFormSubmission: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi
        .fn()
        .mockImplementationOnce(async (callback) => callback(captureTx))
        .mockImplementationOnce(async (callback) => callback(identityTx)),
    } as unknown as ReturnType<typeof getPrisma>);

    await expect(
      submitPublicSmartPageForm(
        "minha-pagina",
        "form_1",
        {
          idempotencyKey: "356fea8c-1f29-42a3-b72c-47d980602d1c",
          values: {
            field_name: "Maria Silva",
            field_email: "maria@example.com",
          },
        },
        new Headers(),
      ),
    ).resolves.toMatchObject({ submitted: true, leadCreated: false });

    expect(captureTx.audienceContact.create).not.toHaveBeenCalled();
    expect(captureTx.smartPageFormSubmission.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ contactId: "contact_1" }),
      }),
    );
    expect(recordAnalyticsEvent).toHaveBeenCalledTimes(1);
    expect(recordAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "form_submit",
        audienceContactId: "contact_1",
      }),
    );
  });
});

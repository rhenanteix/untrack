import { z } from "zod";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { normalizeEmail, normalizePhone } from "@/modules/audience/identity";
import { refreshAudienceContactSummary } from "@/modules/audience/summary";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
  trustedCampaignContext,
} from "@/modules/analytics/public-context";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import type { Actor } from "@/modules/workspaces/context";

const submissionInputSchema = z
  .object({
    values: z
      .record(
        z.string().trim().min(1).max(200),
        z.union([z.string().trim().max(2_000), z.boolean()]),
      )
      .refine((values) => Object.keys(values).length <= 12),
    idempotencyKey: z.string().uuid(),
    visitorId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
    honeypot: z.string().max(0).optional(),
  })
  .strict();

type FormValue = string | boolean;

export type SmartPageFormOverview = {
  id: string;
  name: string;
  title: string;
  status: "active" | "inactive";
  smartPage: { id: string; title: string; slug: string };
  createdAt: Date;
  updatedAt: Date;
  views: number;
  submissions: number;
  contacts: number;
  leads: number;
  submissionRate: number;
};

type Field = {
  id: string;
  fieldType: string;
  label: string;
  required: boolean;
  options: Prisma.JsonValue;
};

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function hasValue(value: FormValue | undefined) {
  return typeof value === "boolean" ? value : Boolean(value?.trim());
}

function fieldOptions(field: Field) {
  return Array.isArray(field.options)
    ? field.options.filter(
        (option): option is string => typeof option === "string",
      )
    : [];
}

function validationError(field: Field, message: string): never {
  throw new ApiError(422, "INVALID_FORM_FIELD", `${field.label}: ${message}`);
}

function validatedValues(
  fields: Field[],
  rawValues: Record<string, FormValue>,
) {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  for (const fieldId of Object.keys(rawValues)) {
    if (!fieldsById.has(fieldId)) {
      throw new ApiError(
        422,
        "UNKNOWN_FORM_FIELD",
        "Um dos campos enviados não pertence a este formulário.",
      );
    }
  }

  const values: Record<string, FormValue> = {};
  for (const field of fields) {
    const raw = rawValues[field.id];
    if (raw === undefined) {
      if (field.required) validationError(field, "este campo é obrigatório.");
      continue;
    }
    if (["consent", "checkbox"].includes(field.fieldType)) {
      if (typeof raw !== "boolean")
        validationError(field, "selecione uma opção válida.");
      if (field.required && !raw)
        validationError(field, "este campo é obrigatório.");
      values[field.id] = raw;
      continue;
    }
    if (typeof raw !== "string")
      validationError(field, "informe um valor válido.");
    const value = raw.trim();
    if (!value) {
      if (field.required) validationError(field, "este campo é obrigatório.");
      continue;
    }
    if (field.fieldType === "email" && !/^\S+@\S+\.\S+$/.test(value))
      validationError(field, "informe um e-mail válido.");
    if (field.fieldType === "phone" && !/^\+?[0-9 ()-]{7,24}$/.test(value))
      validationError(field, "informe um telefone válido.");
    if (field.fieldType === "select" && !fieldOptions(field).includes(value))
      validationError(field, "selecione uma opção válida.");
    values[field.id] =
      field.fieldType === "phone" ? normalizePhone(value) : value;
  }
  return values;
}

function contactData(fields: Field[], values: Record<string, FormValue>) {
  const customFields: Record<string, FormValue> = {};
  let firstName: string | undefined;
  let lastName: string | undefined;
  let email: string | undefined;
  let phone: string | undefined;
  let company: string | undefined;
  let jobTitle: string | undefined;
  let consentGiven = false;
  let consentText: string | undefined;

  for (const field of fields) {
    const value = values[field.id];
    if (!hasValue(value)) continue;
    if (field.fieldType === "name" && typeof value === "string") {
      const [first, ...rest] = value.trim().split(/\s+/);
      firstName = first;
      lastName = rest.join(" ") || undefined;
    } else if (field.fieldType === "email" && typeof value === "string") {
      email = normalizeEmail(value);
    } else if (field.fieldType === "phone" && typeof value === "string") {
      phone = normalizePhone(value);
    } else if (field.fieldType === "company" && typeof value === "string") {
      company = value;
    } else if (field.fieldType === "job_title" && typeof value === "string") {
      jobTitle = value;
    } else if (field.fieldType === "consent" && value === true) {
      consentGiven = true;
      consentText = field.label;
    } else {
      customFields[field.id] = value;
    }
  }
  if (!email && !phone) {
    throw new ApiError(
      422,
      "CONTACT_IDENTITY_REQUIRED",
      "Informe um e-mail ou telefone para enviar o formulário.",
    );
  }
  return {
    firstName,
    lastName,
    email,
    phone,
    company,
    jobTitle,
    customFields,
    consentGiven,
    consentText,
  };
}

export async function listSmartPageFormOverviews(
  actor: Actor,
): Promise<SmartPageFormOverview[]> {
  const db = getPrisma();
  const forms = await db.smartPageForm.findMany({
    where: { workspaceId: actor.workspaceId },
    select: {
      id: true,
      name: true,
      title: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      smartPage: { select: { id: true, title: true, slug: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 200,
  });
  if (!forms.length) return [];
  const formIds = forms.map((form) => form.id);
  const [events, contacts] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["elementId", "name"],
      where: {
        workspaceId: actor.workspaceId,
        elementType: "form",
        elementId: { in: formIds },
        name: { in: ["form_view", "form_submit", "lead_created"] },
      },
      _count: { _all: true },
    }),
    db.smartPageFormSubmission.groupBy({
      by: ["formId", "contactId"],
      where: {
        workspaceId: actor.workspaceId,
        formId: { in: formIds },
        contactId: { not: null },
      },
    }),
  ]);
  const eventCounts = new Map<string, Record<string, number>>();
  for (const event of events) {
    if (!event.elementId) continue;
    const counts = eventCounts.get(event.elementId) ?? {};
    counts[event.name] = event._count._all;
    eventCounts.set(event.elementId, counts);
  }
  const contactCounts = new Map<string, number>();
  for (const contact of contacts)
    contactCounts.set(
      contact.formId,
      (contactCounts.get(contact.formId) ?? 0) + 1,
    );
  return forms.map((form) => {
    const counts = eventCounts.get(form.id) ?? {};
    const views = counts.form_view ?? 0;
    const submissions = counts.form_submit ?? 0;
    return {
      ...form,
      status: form.status,
      views,
      submissions,
      contacts: contactCounts.get(form.id) ?? 0,
      leads: counts.lead_created ?? 0,
      submissionRate: views
        ? Number(((submissions / views) * 100).toFixed(1))
        : 0,
    };
  });
}

export async function getSmartPageFormOverview(actor: Actor, id: string) {
  const form = (await listSmartPageFormOverviews(actor)).find(
    (item) => item.id === id,
  );
  if (!form)
    throw new ApiError(404, "FORM_NOT_FOUND", "Formulário não encontrado.");
  return form;
}

export async function submitPublicSmartPageForm(
  slug: string,
  formId: string,
  raw: unknown,
  headers: Headers,
) {
  const input = submissionInputSchema.parse(raw);
  const db = getPrisma();
  const form = await db.smartPageForm.findFirst({
    where: {
      id: formId,
      status: "active",
      smartPage: { slug, status: "published" },
      smartPageBlock: { visible: true },
    },
    include: {
      fields: { orderBy: { position: "asc" } },
      smartPage: { select: { id: true, slug: true, workspaceId: true } },
      smartPageBlock: { select: { id: true, analyticsEnabled: true } },
    },
  });
  if (!form)
    throw new ApiError(404, "FORM_NOT_FOUND", "Formulário não encontrado.");

  const existing = await db.smartPageFormSubmission.findUnique({
    where: {
      formId_idempotencyKey: { formId, idempotencyKey: input.idempotencyKey },
    },
    select: { id: true, contactId: true },
  });
  if (existing) {
    return {
      submitted: true,
      leadCreated: false,
      successMessage: form.successMessage,
      analyticsCookieHeaders: [],
    };
  }

  const values = validatedValues(form.fields, input.values);
  const contactInput = contactData(form.fields, values);
  const tracking = resolvePublicAnalyticsContext(
    headers,
    { visitorId: input.visitorId, sessionId: input.sessionId },
    {
      utmSource: input.utmSource,
      utmMedium: input.utmMedium,
      utmCampaign: input.utmCampaign,
      utmContent: input.utmContent,
      utmTerm: input.utmTerm,
    },
  );
  const attribution = resolveAttribution({
    ...tracking.attribution,
    referrer: headers.get("referer"),
  });
  const inherited = trustedCampaignContext(headers);
  const campaignId = inherited.campaignId ?? undefined;

  const captured = await db.$transaction(async (tx) => {
    const duplicate = await tx.smartPageFormSubmission.findUnique({
      where: {
        formId_idempotencyKey: { formId, idempotencyKey: input.idempotencyKey },
      },
      select: { id: true, contactId: true },
    });
    if (duplicate) return { duplicate: true, contactId: duplicate.contactId };

    const contact = await tx.audienceContact.findFirst({
      where: {
        workspaceId: form.workspaceId,
        OR: [
          ...(contactInput.email
            ? [
                {
                  email: {
                    equals: contactInput.email,
                    mode: "insensitive" as const,
                  },
                },
              ]
            : []),
          ...(contactInput.phone ? [{ phone: contactInput.phone }] : []),
        ],
      },
    });
    const firstTouch = {
      firstSource: attribution.source,
      firstMedium: attribution.medium,
      firstChannel: attribution.channel,
      firstCampaign: attribution.campaign ?? null,
    };
    const lastTouch = {
      lastSource: attribution.source,
      lastMedium: attribution.medium,
      lastChannel: attribution.channel,
      lastCampaign: attribution.campaign ?? null,
    };
    const contactFields = {
      ...(contactInput.firstName ? { firstName: contactInput.firstName } : {}),
      ...(contactInput.lastName ? { lastName: contactInput.lastName } : {}),
      ...(contactInput.email ? { email: contactInput.email } : {}),
      ...(contactInput.phone ? { phone: contactInput.phone } : {}),
      ...(contactInput.company ? { company: contactInput.company } : {}),
      ...(contactInput.jobTitle ? { jobTitle: contactInput.jobTitle } : {}),
    };
    const savedContact = contact
      ? await tx.audienceContact.update({
          where: { id: contact.id },
          data: {
            ...contactFields,
            customFields: json({
              ...(contact.customFields as Record<string, unknown>),
              ...contactInput.customFields,
            }),
            firstSource: contact.firstSource ?? firstTouch.firstSource,
            firstMedium: contact.firstMedium ?? firstTouch.firstMedium,
            firstChannel: contact.firstChannel ?? firstTouch.firstChannel,
            firstCampaign: contact.firstCampaign ?? firstTouch.firstCampaign,
            ...(contact.creationSource === "unknown"
              ? { creationSource: "form" }
              : {}),
            ...lastTouch,
          },
        })
      : await tx.audienceContact.create({
          data: {
            workspaceId: form.workspaceId,
            creationSource: "form",
            ...contactFields,
            customFields: json(contactInput.customFields),
            ...firstTouch,
            ...lastTouch,
          },
        });
    const submission = await tx.smartPageFormSubmission.create({
      data: {
        workspaceId: form.workspaceId,
        formId: form.id,
        smartPageId: form.smartPageId,
        contactId: savedContact.id,
        campaignId: campaignId ?? null,
        source: attribution.source,
        medium: attribution.medium,
        channel: attribution.channel,
        values: json(values),
        consentGiven: contactInput.consentGiven,
        consentText: contactInput.consentText ?? null,
        consentedAt: contactInput.consentGiven ? new Date() : null,
        idempotencyKey: input.idempotencyKey,
      },
    });
    await tx.audienceContactEvent.create({
      data: {
        workspaceId: form.workspaceId,
        contactId: savedContact.id,
        name: "form_submitted",
        metadata: json({
          formId: form.id,
          submissionId: submission.id,
          smartPageId: form.smartPageId,
          smartPageBlockId: form.smartPageBlockId,
          campaignId: campaignId ?? null,
          source: attribution.source,
        }),
      },
    });
    if (!contact) {
      await tx.audienceContactEvent.create({
        data: {
          workspaceId: form.workspaceId,
          contactId: savedContact.id,
          name: "lead_created",
          metadata: json({
            formId: form.id,
            submissionId: submission.id,
            smartPageId: form.smartPageId,
            campaignId: campaignId ?? null,
          }),
        },
      });
    }
    return {
      duplicate: false,
      contactId: savedContact.id,
      submissionId: submission.id,
      leadCreated: !contact,
    };
  });

  if (captured.duplicate) {
    return {
      submitted: true,
      leadCreated: false,
      successMessage: form.successMessage,
      analyticsCookieHeaders: [],
    };
  }

  if (tracking.trackingAllowed && form.smartPageBlock.analyticsEnabled) {
    try {
      const formEvent = await recordAnalyticsEvent({
        eventId: `form-submit:${captured.submissionId}`,
        name: "form_submit",
        workspaceId: form.workspaceId,
        visitorKey: tracking.identity.visitorId,
        sessionKey: tracking.identity.sessionId,
        audienceContactId: captured.contactId ?? undefined,
        assetType: "smart_page",
        assetId: form.smartPageId,
        elementType: "form",
        elementId: form.id,
        campaignId,
        smartPageId: form.smartPageId,
        smartPageBlockId: form.smartPageBlockId,
        path: `/${form.smartPage.slug}`,
        attribution: tracking.attribution,
        origin: "server",
        headers,
        includeIdentity: true,
      });
      if (captured.leadCreated) {
        await recordAnalyticsEvent({
          eventId: `lead-created:${captured.submissionId}`,
          name: "lead_created",
          workspaceId: form.workspaceId,
          visitorKey: tracking.identity.visitorId,
          sessionKey: tracking.identity.sessionId,
          audienceContactId: captured.contactId ?? undefined,
          assetType: "smart_page",
          assetId: form.smartPageId,
          elementType: "form",
          elementId: form.id,
          campaignId,
          smartPageId: form.smartPageId,
          smartPageBlockId: form.smartPageBlockId,
          path: `/${form.smartPage.slug}`,
          attribution: tracking.attribution,
          origin: "server",
          headers,
        });
      }
      if (formEvent.visitorId || formEvent.sessionId) {
        await db.$transaction(async (tx) => {
          await tx.smartPageFormSubmission.update({
            where: { id: captured.submissionId },
            data: {
              visitorId: formEvent.visitorId ?? null,
              sessionId: formEvent.sessionId ?? null,
            },
          });
          if (formEvent.visitorId)
            await tx.analyticsVisitor.update({
              where: { id: formEvent.visitorId },
              data: { audienceContactId: captured.contactId },
            });
        });
      }
    } catch (error) {
      console.error("Smart Page form analytics was not recorded", error);
    }
  }

  if (captured.contactId)
    void refreshAudienceContactSummary(
      form.workspaceId,
      captured.contactId,
    ).catch((error) =>
      console.error("Smart Page form contact summary was not refreshed", error),
    );

  return {
    submitted: true,
    leadCreated: captured.leadCreated,
    successMessage: form.successMessage,
    analyticsCookieHeaders: publicAnalyticsContextCookies(
      headers,
      tracking,
      attribution,
      { campaignId, qrContext: inherited.qrContext },
    ),
  };
}

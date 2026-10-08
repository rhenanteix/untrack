import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { track } from "@/lib/analytics";
import { getPrisma } from "@/lib/prisma";
import { normalizePhone } from "@/modules/audience/identity";
import { refreshAudienceContactSummary } from "@/modules/audience/summary";
import { recordAnalyticsEvent } from "@/modules/analytics/service";
import { resolveAttribution } from "@/modules/analytics/attribution";
import {
  publicAnalyticsContextCookies,
  resolvePublicAnalyticsContext,
  trustedCampaignContext,
} from "@/modules/analytics/public-context";
import { PAGE_SIZE } from "@/lib/pagination";
import { createQrAsset } from "@/modules/untrack-qr/service";
import { exportQr, renderVerifiedQr } from "@/modules/untrack-qr/render";
import {
  assertReferences,
  audit,
  releaseQuota,
  reserveQuota,
  workspaceTransaction,
  type Actor,
} from "@/modules/workspaces/context";
import {
  defaultSmartCardContactForm,
  smartCardCaptureSchema,
  smartCardContactFormSchema,
  smartCardInputSchema,
  smartCardUpdateSchema,
  type SmartCardActionInput,
} from "./schemas";

const cardInclude = {
  actions: { orderBy: { position: "asc" as const } },
  qrAsset: true,
  walletPasses: { orderBy: { updatedAt: "desc" as const } },
  _count: { select: { contactExchanges: true } },
} as const;

const knownContactFields = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "whatsapp",
  "company",
  "jobTitle",
  "city",
]);

function json(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function slugConflict(error: unknown): never {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    throw new ApiError(
      409,
      "SMART_CARD_SLUG_EXISTS",
      "Este endereço já está em uso. Escolha outro para o cartão.",
    );
  }
  throw error;
}

async function workspaceCard(actor: Actor, id: string) {
  const card = await getPrisma().smartCard.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    include: cardInclude,
  });
  if (!card)
    throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
  return card;
}

function actionRows(actions: SmartCardActionInput[]) {
  return actions.map((action, position) => ({ ...action, position }));
}

export async function listSmartCards(actor: Actor, page: number, search = "") {
  const term = search.trim().slice(0, 120);
  const items = await getPrisma().smartCard.findMany({
    where: {
      workspaceId: actor.workspaceId,
      ...(term
        ? {
            OR: [
              { firstName: { contains: term, mode: "insensitive" } },
              { lastName: { contains: term, mode: "insensitive" } },
              { company: { contains: term, mode: "insensitive" } },
              { slug: { contains: term, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: cardInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE + 1,
  });
  return {
    items: items.slice(0, PAGE_SIZE),
    page,
    hasMore: items.length > PAGE_SIZE,
  };
}

export async function getSmartCard(actor: Actor, id: string) {
  return workspaceCard(actor, id);
}

export async function createSmartCard(actor: Actor, raw: unknown) {
  const input = smartCardInputSchema.parse(raw);
  const {
    actions,
    campaignId,
    contactForm,
    contactPoints,
    socialLinks,
    theme,
    ...cardData
  } = input;
  try {
    const card = await workspaceTransaction(
      actor,
      "write",
      async (tx, access) => {
        await assertReferences(tx, actor.workspaceId, { campaignId });
        await reserveQuota(tx, actor.workspaceId, access, "smartCards");
        const card = await tx.smartCard.create({
          data: {
            ...cardData,
            workspaceId: actor.workspaceId,
            ownerId: actor.userId,
            campaignId: campaignId ?? null,
            theme: json(theme),
            contactForm: json(contactForm),
            contactPoints: json(contactPoints),
            socialLinks: json(socialLinks),
            actions: { create: actionRows(actions) },
          },
          include: cardInclude,
        });
        await audit(tx, actor, "smartCard.created", card.id, {
          slug: card.slug,
          campaignId: card.campaignId,
        });
        return card;
      },
    );
    await track("smart_card_created", { workspaceId: actor.workspaceId });
    return card;
  } catch (error) {
    return slugConflict(error);
  }
}

export async function updateSmartCard(actor: Actor, id: string, raw: unknown) {
  const input = smartCardUpdateSchema.parse(raw);
  const {
    actions,
    campaignId,
    contactForm,
    contactPoints,
    socialLinks,
    theme,
    ...cardData
  } = input;
  try {
    return await workspaceTransaction(actor, "write", async (tx) => {
      const current = await tx.smartCard.findFirst({
        where: { id, workspaceId: actor.workspaceId },
      });
      if (!current)
        throw new ApiError(
          404,
          "SMART_CARD_NOT_FOUND",
          "Cartão não encontrado.",
        );
      if (campaignId !== undefined)
        await assertReferences(tx, actor.workspaceId, { campaignId });
      if (actions !== undefined) {
        await tx.smartCardAction.deleteMany({ where: { smartCardId: id } });
        if (actions.length)
          await tx.smartCardAction.createMany({
            data: actionRows(actions).map((action) => ({
              ...action,
              smartCardId: id,
            })),
          });
      }
      const card = await tx.smartCard.update({
        where: { id },
        data: {
          ...cardData,
          ...(campaignId === undefined ? {} : { campaignId }),
          ...(theme === undefined ? {} : { theme: json(theme) }),
          ...(contactForm === undefined
            ? {}
            : { contactForm: json(contactForm) }),
          ...(contactPoints === undefined
            ? {}
            : { contactPoints: json(contactPoints) }),
          ...(socialLinks === undefined
            ? {}
            : { socialLinks: json(socialLinks) }),
        },
        include: cardInclude,
      });
      if (Object.keys(input).length > 0) {
        await tx.smartCardWalletPass.updateMany({
          where: { smartCardId: id, status: "synced" },
          data: { status: "pending_sync", lastError: null },
        });
      }
      await audit(tx, actor, "smartCard.updated", id, {
        before: { slug: current.slug },
        fields: Object.keys(input),
      });
      return card;
    });
  } catch (error) {
    return slugConflict(error);
  }
}

export async function deleteSmartCard(actor: Actor, id: string) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const card = await tx.smartCard.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { id: true, slug: true },
    });
    if (!card)
      throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
    await tx.smartCard.delete({ where: { id } });
    await releaseQuota(tx, actor.workspaceId, "smartCards");
    await audit(tx, actor, "smartCard.deleted", id, { slug: card.slug });
  });
}

export async function setSmartCardPublished(
  actor: Actor,
  id: string,
  published: boolean,
) {
  return workspaceTransaction(actor, "write", async (tx) => {
    const current = await tx.smartCard.findFirst({
      where: { id, workspaceId: actor.workspaceId },
    });
    if (!current)
      throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
    const card = await tx.smartCard.update({
      where: { id },
      data: {
        status: published ? "published" : "draft",
        publishedAt: published ? new Date() : null,
      },
      include: cardInclude,
    });
    await audit(
      tx,
      actor,
      published ? "smartCard.published" : "smartCard.unpublished",
      id,
    );
    return card;
  });
}

export async function ensureSmartCardQr(actor: Actor, id: string) {
  const card = await workspaceCard(actor, id);
  if (card.qrAsset) {
    const rendered = await renderVerifiedQr(
      card.qrAsset.encodedUrl,
      card.qrAsset.visual,
    );
    return { qr: card.qrAsset, created: false, dataUrl: rendered.dataUrl };
  }

  const result = await createQrAsset(actor, {
    name: `Cartão ${card.firstName} ${card.lastName}`.trim(),
    url: new URL(`/c/${encodeURIComponent(card.slug)}?source=qr`, appUrl())
      .href,
    mode: "dynamic",
    visual: {
      width: 512,
      margin: 4,
      dark: "#172a3a",
      light: "#ffffff",
      printLabel: card.firstName,
    },
    campaignId: card.campaignId,
  });
  const updated = await workspaceTransaction(actor, "write", async (tx) => {
    const current = await tx.smartCard.findFirst({
      where: { id, workspaceId: actor.workspaceId },
      select: { qrAssetId: true },
    });
    if (!current)
      throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
    if (current.qrAssetId)
      return tx.qrAsset.findUniqueOrThrow({ where: { id: current.qrAssetId } });
    return tx.smartCard
      .update({ where: { id }, data: { qrAssetId: result.qr.id } })
      .qrAsset();
  });
  return { qr: updated ?? result.qr, created: true, dataUrl: result.dataUrl };
}

export async function publicSmartCard(slug: string) {
  return getPrisma().smartCard.findFirst({
    where: { slug, status: "published" },
    include: {
      actions: { where: { visible: true }, orderBy: { position: "asc" } },
      qrAsset: { select: { id: true } },
      walletPasses: {
        select: { provider: true, status: true },
      },
    },
  });
}

export async function publicSmartCardQr(slug: string) {
  const card = await getPrisma().smartCard.findFirst({
    where: { slug, status: "published" },
    select: {
      qrAsset: { select: { encodedUrl: true, visual: true } },
    },
  });
  if (!card?.qrAsset) {
    throw new ApiError(404, "SMART_CARD_QR_NOT_FOUND", "QR não encontrado.");
  }
  return exportQr(card.qrAsset.encodedUrl, card.qrAsset.visual, "png");
}

function contactConsentText(card: {
  firstName: string;
  lastName: string;
  company: string;
}) {
  const recipient = card.company || `${card.firstName} ${card.lastName}`.trim();
  return `Seus dados serão compartilhados com ${recipient} para que possa entrar em contato.`;
}

function validContactValues(
  form: ReturnType<typeof smartCardContactFormSchema.parse>,
  values: Record<string, string>,
) {
  const output: Record<string, string> = {};
  for (const field of form.fields) {
    const value = values[field.key]?.trim() ?? "";
    if (!value && field.required)
      throw new ApiError(
        422,
        "CONTACT_FIELD_REQUIRED",
        `Informe ${field.label}.`,
      );
    if (!value) continue;
    if (field.type === "email" && !/^\S+@\S+\.\S+$/.test(value))
      throw new ApiError(
        422,
        "INVALID_CONTACT_FIELD",
        `Informe ${field.label} válido.`,
      );
    if (field.type === "tel" && !/^\+?[0-9 ()-]{7,24}$/.test(value))
      throw new ApiError(
        422,
        "INVALID_CONTACT_FIELD",
        `Informe ${field.label} válido.`,
      );
    if (field.type === "select" && !field.options.includes(value))
      throw new ApiError(
        422,
        "INVALID_CONTACT_FIELD",
        `Selecione ${field.label}.`,
      );
    output[field.key] = field.type === "tel" ? normalizePhone(value) : value;
  }
  return output;
}

export async function captureSmartCardContact(
  slug: string,
  raw: unknown,
  headers: Headers,
) {
  const input = smartCardCaptureSchema.parse(raw);
  const card = await publicSmartCard(slug);
  if (!card)
    throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
  const form = smartCardContactFormSchema.parse(
    card.contactForm ?? defaultSmartCardContactForm,
  );
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
  const inheritedCampaign = inherited.campaignId
    ? await getPrisma().campaign.findFirst({
        where: { id: inherited.campaignId, workspaceId: card.workspaceId },
        select: { id: true },
      })
    : null;
  const campaignId = inheritedCampaign?.id ?? card.campaignId ?? undefined;
  const campaignAsset =
    campaignId && inherited.campaignAssetId
      ? await getPrisma().campaignAsset.findFirst({
          where: {
            id: inherited.campaignAssetId,
            workspaceId: card.workspaceId,
            campaignId,
          },
          select: { id: true },
        })
      : null;
  const campaignAssetId = campaignAsset?.id;
  const values = validContactValues(form, input.values);
  if (
    input.intent &&
    (!form.intent.enabled || !form.intent.options.includes(input.intent))
  )
    throw new ApiError(
      422,
      "INVALID_CONTACT_INTENT",
      "Selecione um interesse válido.",
    );

  const contact = await getPrisma().$transaction(async (tx) => {
    const email = values.email?.toLowerCase();
    const phone = values.phone;
    const whatsapp = values.whatsapp;
    const existing =
      email || phone || whatsapp
        ? await tx.audienceContact.findFirst({
            where: {
              workspaceId: card.workspaceId,
              OR: [
                ...(email ? [{ email }] : []),
                ...(phone ? [{ phone }] : []),
                ...(whatsapp ? [{ whatsapp }] : []),
              ],
            },
          })
        : null;
    const customFields = Object.fromEntries(
      Object.entries(values).filter(([key]) => !knownContactFields.has(key)),
    );
    const data = {
      firstName: values.firstName ?? "",
      lastName: values.lastName ?? "",
      email: email ?? null,
      phone: phone ?? null,
      whatsapp: whatsapp ?? null,
      company: values.company ?? null,
      jobTitle: values.jobTitle ?? null,
      city: values.city ?? null,
      customFields: json(customFields),
    };
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
    let saved;
    if (existing) {
      saved = await tx.audienceContact.update({
        where: { id: existing.id },
        data: {
          ...Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== null),
          ),
          ...(existing.creationSource === "unknown"
            ? { creationSource: "smart_card_exchange" }
            : {}),
          firstSource: existing.firstSource ?? firstTouch.firstSource,
          firstMedium: existing.firstMedium ?? firstTouch.firstMedium,
          firstChannel: existing.firstChannel ?? firstTouch.firstChannel,
          firstCampaign: existing.firstCampaign ?? firstTouch.firstCampaign,
          ...lastTouch,
          customFields: json({
            ...(existing.customFields as Record<string, unknown>),
            ...customFields,
          }),
        },
      });
    } else {
      saved = await tx.audienceContact.create({
        data: {
          workspaceId: card.workspaceId,
          creationSource: "smart_card_exchange",
          ...data,
          ...firstTouch,
          ...lastTouch,
        },
      });
    }
    const exchange = await tx.smartCardContactExchange.create({
      data: {
        workspaceId: card.workspaceId,
        smartCardId: card.id,
        contactId: saved.id,
        campaignId,
        source: attribution.source,
        sourceLabel: input.sourceLabel ?? null,
        intent: input.intent ?? null,
        context: json({ cardSlug: card.slug, channel: attribution.channel }),
        consentText: contactConsentText(card),
      },
    });
    await tx.audienceContactEvent.create({
      data: {
        workspaceId: card.workspaceId,
        contactId: saved.id,
        name: "contact_captured",
        metadata: json({
          smartCardId: card.id,
          exchangeId: exchange.id,
          source: attribution.source,
          intent: input.intent ?? null,
        }),
      },
    });
    if (!existing) {
      await tx.audienceContactEvent.create({
        data: {
          workspaceId: card.workspaceId,
          contactId: saved.id,
          name: "lead_created",
          metadata: json({
            smartCardId: card.id,
            exchangeId: exchange.id,
            source: attribution.source,
          }),
        },
      });
    }
    return { contact: saved, leadCreated: !existing };
  });
  if (tracking.trackingAllowed)
    try {
      const formEvent = await recordAnalyticsEvent({
        eventId: randomUUID(),
        name: "form_submit",
        workspaceId: card.workspaceId,
        visitorKey: tracking.identity.visitorId,
        sessionKey: tracking.identity.sessionId,
        audienceContactId: contact.contact.id,
        assetType: "smart_card",
        assetId: card.id,
        campaignId,
        campaignAssetId,
        smartCardId: card.id,
        path: `/c/${slug}`,
        attribution: tracking.attribution,
        origin: "server",
        headers,
        includeIdentity: true,
      });
      await recordAnalyticsEvent({
        eventId: randomUUID(),
        name: "contact_exchange_submit",
        workspaceId: card.workspaceId,
        visitorKey: tracking.identity.visitorId,
        sessionKey: tracking.identity.sessionId,
        audienceContactId: contact.contact.id,
        assetType: "smart_card",
        assetId: card.id,
        campaignId,
        campaignAssetId,
        smartCardId: card.id,
        path: `/c/${slug}`,
        attribution: tracking.attribution,
        origin: "server",
        headers,
      });
      if (formEvent.visitorId)
        await getPrisma().analyticsVisitor.update({
          where: { id: formEvent.visitorId },
          data: { audienceContactId: contact.contact.id },
        });
      if (contact.leadCreated)
        await recordAnalyticsEvent({
          eventId: randomUUID(),
          name: "lead_created",
          workspaceId: card.workspaceId,
          visitorKey: tracking.identity.visitorId,
          sessionKey: tracking.identity.sessionId,
          audienceContactId: contact.contact.id,
          assetType: "smart_card",
          assetId: card.id,
          campaignId,
          campaignAssetId,
          smartCardId: card.id,
          path: `/c/${slug}`,
          attribution: tracking.attribution,
          origin: "server",
          headers,
        });
    } catch (error) {
      console.error("Smart Card conversion analytics was not recorded", error);
    }
  void refreshAudienceContactSummary(card.workspaceId, contact.contact.id).catch(
    (error) =>
      console.error("Smart Card contact summary was not refreshed", error),
  );
  return {
    contact: contact.contact,
    consentText: contactConsentText(card),
    analyticsCookieHeaders: publicAnalyticsContextCookies(
      headers,
      tracking,
      attribution,
      { campaignId, campaignAssetId, qrContext: inherited.qrContext },
    ),
  };
}

export async function smartCardMetrics(actor: Actor, id: string, days: number) {
  const card = await getPrisma().smartCard.findFirst({
    where: { id, workspaceId: actor.workspaceId },
    select: { id: true },
  });
  if (!card)
    throw new ApiError(404, "SMART_CARD_NOT_FOUND", "Cartão não encontrado.");
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const db = getPrisma();
  const viewWhere = {
    smartCardId: card.id,
    name: { in: ["card_view", "smart_card_view"] },
    day: { gte: start },
  };
  const interactionWhere = {
    smartCardId: card.id,
    name: {
      in: [
        "link_click",
        "whatsapp_click",
        "booking_click",
        "contact_save",
        "website_click",
        "button_click",
        "save_contact_click",
        "social_click",
        "apple_wallet_add_click",
        "google_wallet_add_click",
      ],
    },
    day: { gte: start },
  };
  const [
    views,
    qrScans,
    appleWalletClicks,
    googleWalletClicks,
    interactions,
    visitors,
    contacts,
    conversions,
    exchangeOpens,
    exchangeSubmits,
    leadsCreated,
    topActions,
    sources,
  ] = await Promise.all([
    db.analyticsEvent.count({ where: viewWhere }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: { in: ["qr_scan", "smart_card_qr_scan"] },
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "apple_wallet_add_click",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "google_wallet_add_click",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({ where: interactionWhere }),
    db.analyticsEvent.groupBy({
      by: ["visitorHash"],
      where: { ...viewWhere, visitorHash: { not: null } },
    }),
    db.smartCardContactExchange.count({
      where: { smartCardId: card.id, capturedAt: { gte: start } },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "booking_click",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "contact_exchange_open",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "contact_exchange_submit",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.count({
      where: {
        smartCardId: card.id,
        name: "lead_created",
        day: { gte: start },
      },
    }),
    db.analyticsEvent.groupBy({
      by: ["smartCardActionId"],
      where: { ...interactionWhere, smartCardActionId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { smartCardActionId: "desc" } },
      take: 5,
    }),
    db.analyticsEvent.groupBy({
      by: ["referrer"],
      where: { ...viewWhere, referrer: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { referrer: "desc" } },
      take: 8,
    }),
  ]);
  const actionIds = topActions.flatMap((action) =>
    action.smartCardActionId ? [action.smartCardActionId] : [],
  );
  const actions = await db.smartCardAction.findMany({
    where: { id: { in: actionIds }, smartCardId: card.id },
    select: { id: true, label: true },
  });
  const actionNames = new Map(
    actions.map((action) => [action.id, action.label]),
  );
  const exchangeOpenRate =
    exchangeOpens > 0
      ? Math.round((exchangeSubmits / exchangeOpens) * 100)
      : null;
  return {
    periodDays: days,
    views,
    qrScans,
    appleWalletClicks,
    googleWalletClicks,
    walletAddsConfirmed: null,
    uniqueVisitors: visitors.length,
    interactions,
    contacts,
    conversions,
    exchangeOpens,
    exchangeSubmits,
    leadsCreated,
    exchangeOpenRate,
    funnel: [
      { key: "views", label: "Visualizações", value: views },
      {
        key: "wallet_cta_clicks",
        label: "CTA de Wallet clicada",
        value: appleWalletClicks + googleWalletClicks,
      },
      { key: "exchange_opens", label: "Aberturas de troca de contatos", value: exchangeOpens },
      { key: "exchange_submits", label: "Envios de troca de contatos", value: exchangeSubmits },
      { key: "leads_created", label: "Novos contatos", value: leadsCreated },
    ],
    topActions: topActions.flatMap((item) =>
      item.smartCardActionId
        ? [
            {
              actionId: item.smartCardActionId,
              label: actionNames.get(item.smartCardActionId) ?? "Ação",
              clicks: item._count._all,
            },
          ]
        : [],
    ),
    trafficSources: sources.flatMap((source) =>
      source.referrer
        ? [{ name: source.referrer, views: source._count._all }]
        : [],
    ),
  };
}

export async function smartCardDashboardMetrics(actor: Actor) {
  const db = getPrisma();
  const cardEventWhere = {
    workspaceId: actor.workspaceId,
    smartCardId: { not: null },
  };
  const [active, views, contacts, saves, conversions, exchangeOpens, exchangeSubmits, leadsCreated] = await Promise.all([
    db.smartCard.count({
      where: { workspaceId: actor.workspaceId, status: "published" },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "card_view" },
    }),
    db.smartCardContactExchange.count({
      where: { workspaceId: actor.workspaceId },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "contact_save" },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "booking_click" },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "contact_exchange_open" },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "contact_exchange_submit" },
    }),
    db.analyticsEvent.count({
      where: { ...cardEventWhere, name: "lead_created" },
    }),
  ]);
  return { active, views, contacts, saves, conversions, exchangeOpens, exchangeSubmits, leadsCreated };
}

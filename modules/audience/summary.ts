import { getPrisma } from "@/lib/prisma";

const nonInteractionEvents = [
  "form_submit",
  "lead_created",
  "goal_completed",
];

function earliest(...values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date);
  return new Date(Math.min(...dates.map((value) => value.getTime())));
}

function latest(...values: Array<Date | null | undefined>) {
  const dates = values.filter((value): value is Date => value instanceof Date);
  return new Date(Math.max(...dates.map((value) => value.getTime())));
}

/**
 * Derives Audience state from contacts' legitimately associated visitors.
 * LOW has no post-identification interaction; MEDIUM has two or more;
 * HIGH combines a conversion with a post-identification interaction.
 */
export async function refreshAudienceContactSummary(
  workspaceId: string,
  contactId: string,
) {
  const db = getPrisma();
  const contact = await db.audienceContact.findFirst({
    where: { id: contactId, workspaceId },
    select: { id: true, createdAt: true },
  });
  if (!contact) return;

  const relatedEvents = {
    workspaceId,
    isBot: false,
    isTest: false,
    OR: [
      { audienceContactId: contactId },
      { visitor: { is: { audienceContactId: contactId } } },
    ],
  };
  const postIdentificationEvents = {
    ...relatedEvents,
    occurredAt: { gt: contact.createdAt },
    name: { notIn: nonInteractionEvents },
  };

  const [events, submissions, exchanges, conversionCount, interactions] =
    await Promise.all([
      db.analyticsEvent.aggregate({
        where: relatedEvents,
        _min: { occurredAt: true },
        _max: { occurredAt: true },
      }),
      db.smartPageFormSubmission.aggregate({
        where: { workspaceId, contactId },
        _min: { submittedAt: true },
        _max: { submittedAt: true },
      }),
      db.smartCardContactExchange.aggregate({
        where: { workspaceId, contactId },
        _min: { capturedAt: true },
        _max: { capturedAt: true },
      }),
      db.analyticsConversion.count({
        where: {
          workspaceId,
          isBot: false,
          isTest: false,
          visitor: { is: { audienceContactId: contactId } },
        },
      }),
      db.analyticsEvent.count({ where: postIdentificationEvents }),
    ]);

  const audienceStatus =
    conversionCount > 0
      ? "converted"
      : interactions > 0
        ? "engaged"
        : "new";
  const engagementLevel =
    conversionCount > 0 && interactions > 0
      ? "high"
      : interactions >= 2
        ? "medium"
        : "low";

  await db.audienceContact.update({
    where: { id: contactId },
    data: {
      firstSeenAt: earliest(
        contact.createdAt,
        events._min.occurredAt,
        submissions._min.submittedAt,
        exchanges._min.capturedAt,
      ),
      lastSeenAt: latest(
        contact.createdAt,
        events._max.occurredAt,
        submissions._max.submittedAt,
        exchanges._max.capturedAt,
      ),
      conversionCount,
      meaningfulInteractionCount: interactions,
      audienceStatus,
      engagementLevel,
    },
  });
}
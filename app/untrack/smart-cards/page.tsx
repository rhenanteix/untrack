import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SmartCardsDashboard } from "@/components/untrack/smart-cards-dashboard";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { appUrl } from "@/lib/app-url";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import {
  defaultSmartCardContactForm,
  defaultSmartCardTheme,
  smartCardContactPointSchema,
  smartCardContactFormSchema,
  smartCardSocialLinksSchema,
  smartCardThemeSchema,
} from "@/modules/smart-cards/schemas";
import {
  listSmartCards,
  smartCardDashboardMetrics,
} from "@/modules/smart-cards/service";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { actorFor } from "@/modules/workspaces/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Smart Cards" };

async function loadSmartCardsPage(requestHeaders: Headers, userId: string) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const [initial, campaigns, overview] = await Promise.all([
      listSmartCards(actor, 1),
      getPrisma().campaign.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, name: true },
      }),
      smartCardDashboardMetrics(actor),
    ]);
    return { ok: true as const, actor, initial, campaigns, overview };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Smart Cards workspace load failed", error);
    return { ok: false as const, failure };
  }
}

export default async function SmartCardsPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/smart-cards");
  const data = await loadSmartCardsPage(requestHeaders, session.user.id);
  if (!data.ok) return <WorkspaceLoadError {...data.failure} />;
  return (
    <SmartCardsDashboard
      initial={{
        ...data.initial,
        items: data.initial.items.map((card) => ({
          ...card,
          publishedAt: card.publishedAt?.toISOString() ?? null,
          theme:
            smartCardThemeSchema.safeParse(card.theme).data ??
            defaultSmartCardTheme,
          contactForm:
            smartCardContactFormSchema.safeParse(card.contactForm).data ??
            defaultSmartCardContactForm,
          contactPoints: Array.isArray(card.contactPoints)
            ? card.contactPoints.flatMap((point) => {
                const parsed = smartCardContactPointSchema.safeParse(point);
                return parsed.success ? [parsed.data] : [];
              })
            : [],
          socialLinks:
            smartCardSocialLinksSchema.safeParse(card.socialLinks).data ?? [],
        })),
      }}
      campaigns={data.campaigns}
      currentUserId={session.user.id}
      currentUserName={session.user.name}
      publicOrigin={appUrl().origin}
      overview={data.overview}
      canEdit={data.actor.role !== "viewer"}
    />
  );
}

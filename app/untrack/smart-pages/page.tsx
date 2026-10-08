import { libraryFilters } from "@/modules/workspaces/library-filters";
import { isPremium } from "@/modules/billing/plans";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PremiumGate } from "@/components/premium-gate";
import { SmartPagesDashboard } from "@/components/untrack/smart-pages-dashboard";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { listSmartPages } from "@/modules/smart-pages/service";
import {
  smartPageThemeSchema,
  socialLinksSchema,
} from "@/modules/smart-pages/schemas";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { appUrl } from "@/lib/app-url";
import { actorFor } from "@/modules/workspaces/context";

async function loadPageData(
  requestHeaders: Headers,
  userId: string,
  filters: { page: number; search: string },
) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const [initial, managedLinks, products, access] = await Promise.all([
      listSmartPages(actor, filters.page, filters.search),
      getPrisma().shortLink.findMany({
        where: { workspaceId: actor.workspaceId, distribution: "digital" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          slug: true,
          destinationUrl: true,
          domainKey: true,
          isActive: true,
          expiresAt: true,
        },
      }),
      getPrisma().product.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, name: true, status: true },
      }),
      getAccountAccessForUser(userId),
    ]);
    return { ok: true as const, actor, initial, managedLinks, products, access };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Smart Pages workspace load failed", error);
    return { ok: false as const, error: failure };
  }
}

export default async function SmartPagesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const url = new URL("https://untrack.local/");
  for (const key of ["page", "search"])
    if (typeof query[key] === "string") url.searchParams.set(key, query[key]);
  let filters = { page: 1, search: "" };
  try {
    filters = libraryFilters(url);
  } catch {
    /* Invalid bookmarks fall back to the first page. */
  }
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/smart-pages");
  const data = await loadPageData(requestHeaders, session.user.id, filters);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const { actor, initial, managedLinks, products, access } = data;
  const premium = isPremium(access);
  return (
    <>
      {!premium && (
        <section className="sp-premium-banner">
          <span className="eyebrow">Personalização avançada</span>
          <h1>Sua primeira Smart Page já está incluída.</h1>
          <p>
            Publique, compartilhe e acompanhe sua página. Imagens, produtos e
            personalizações avançadas ficam disponíveis no Premium.
          </p>
          <PremiumGate
            feature="Personalização avançada"
            description="Adicione imagens próprias, produtos e recursos visuais avançados à sua Smart Page."
            trialStatus={access.trialStatus}
          />
        </section>
      )}
      <SmartPagesDashboard
        canEdit={actor.role !== "viewer"}
        canUnpublish={actor.role !== "viewer"}
        publicOrigin={appUrl().origin}
        userPlan={access.effectivePlan}
        hasActiveTrial={access.trialStatus === "active"}
        initial={{
          ...initial,
          items: initial.items.map((page) => ({
            ...page,
            publishedAt: page.publishedAt?.toISOString() ?? null,
            createdAt: page.createdAt.toISOString(),
            updatedAt: page.updatedAt.toISOString(),
            theme: smartPageThemeSchema.safeParse(page.theme).data ?? {
              preset: "minimal",
            },
            socialLinks:
              socialLinksSchema.safeParse(page.socialLinks).data ?? [],
          })),
        }}
        managedLinks={managedLinks.map((link) => ({
          ...link,
          expiresAt: link.expiresAt?.toISOString() ?? null,
        }))}
        products={products}
      />
    </>
  );
}

export const metadata = { title: "Smart Pages" };

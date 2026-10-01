import { libraryFilters } from "@/modules/workspaces/library-filters";
import Link from "next/link";
import { hasSmartPages, smartPagesPrice } from "@/modules/billing/plans";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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
    const [initial, managedLinks, workspace] = await Promise.all([
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
      getPrisma().workspace.findUniqueOrThrow({
        where: { id: actor.workspaceId },
        select: { plan: true },
      }),
    ]);
    return { ok: true as const, actor, initial, managedLinks, workspace };
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
  const { actor, initial, managedLinks, workspace } = data;
  const premium = hasSmartPages(workspace.plan);
  return (
    <>
      {!premium && (
        <section className="sp-premium-banner">
          <span className="eyebrow">Smart Pages Premium</span>
          <h1>Seu perfil merece um cartão à altura.</h1>
          <p>
            21 modelos, editor visual, foto personalizada e links para tudo o
            que você faz.
          </p>
          <strong>{smartPagesPrice}</strong>
          <p>
            Preço previsto. Cobrança ainda não disponível. Nenhum pagamento será
            solicitado agora.
          </p>
          <Link className="button button-secondary" href="/untrack/usage">
            Ver plano e cotas
          </Link>
          <p>
            Se você já possui páginas, elas continuam acessíveis. Criar ou
            editar exige um workspace premium.
          </p>
        </section>
      )}
      <SmartPagesDashboard
        canEdit={premium && actor.role !== "viewer"}
        canUnpublish={actor.role !== "viewer"}
        readOnlyReason={
          !premium
            ? "Seu plano permite consultar as páginas existentes. Criar e editar faz parte do Smart Pages Premium."
            : undefined
        }
        publicOrigin={appUrl().origin}
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
      />
    </>
  );
}

export const metadata = { title: "Smart Pages" };

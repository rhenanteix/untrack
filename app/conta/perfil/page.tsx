import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";
import { serializeLink } from "@/lib/short-links";
import { PAGE_SIZE } from "@/lib/pagination";
import { AccountDashboard } from "@/components/account-dashboard";
import { SignOutButton } from "@/components/sign-out-button";

export const metadata: Metadata = {
  title: "Perfil e histórico",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await sessionFromHeaders(await headers());
  if (!session) redirect("/entrar?next=/conta");
  const actor = await actorFor(session.user.id, await headers());
  const [links, history, totalLinks, activeLinks, clicks, publishedPages] =
    await Promise.all([
      getPrisma().shortLink.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
        include: { _count: { select: { clicks: true } } },
      }),
      getPrisma().linkHistory.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: PAGE_SIZE + 1,
      }),
      getPrisma().shortLink.count({
        where: { workspaceId: actor.workspaceId },
      }),
      getPrisma().shortLink.count({
        where: { workspaceId: actor.workspaceId, isActive: true },
      }),
      getPrisma().linkClick.count({
        where: { link: { workspaceId: actor.workspaceId } },
      }),
      getPrisma().smartPage.count({
        where: { workspaceId: actor.workspaceId, status: "published" },
      }),
    ]);
  return (
    <section className="shell page-section">
      <div className="dashboard-heading account-welcome">
        <div>
          <span className="eyebrow">Meu painel</span>
          <h1>Perfil e histórico</h1>
          <p>Dados da sua conta e histórico detalhado de uso.</p>
        </div>
        <SignOutButton />
      </div>
      <AccountDashboard
        profile={{
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
        }}
        insights={{ totalLinks, activeLinks, clicks, publishedPages }}
        initialLinks={{
          items: links.slice(0, PAGE_SIZE).map(serializeLink),
          page: 1,
          hasMore: links.length > PAGE_SIZE,
        }}
        initialHistory={{
          items: history
            .slice(0, PAGE_SIZE)
            .map(({ id, originalUrl, resultUrl, kind, createdAt }) => ({
              id,
              originalUrl,
              resultUrl,
              kind,
              createdAt: createdAt.toISOString(),
            })),
          page: 1,
          hasMore: history.length > PAGE_SIZE,
        }}
      />
    </section>
  );
}

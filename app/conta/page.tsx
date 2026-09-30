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
  title: "Minha conta",
  robots: { index: false, follow: false },
};

export default async function AccountPage() {
  const session = await sessionFromHeaders(await headers());
  if (!session) redirect("/entrar?next=/conta");
  const actor = await actorFor(session.user.id, await headers());
  const [links, history] = await Promise.all([
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
  ]);
  return (
    <section className="shell page-section">
      <div className="dashboard-heading account-welcome">
        <div>
          <span className="eyebrow">Seu espaço</span>
          <h1>Olá, {session.user.name}.</h1>
          <p>Seus links, resultados e métricas em um só lugar.</p>
        </div>
        <SignOutButton />
      </div>
      <AccountDashboard
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

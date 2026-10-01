import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
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
  const [links, history, totalLinks, activeLinks, clicks, publishedPages] = await Promise.all([
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
    getPrisma().shortLink.count({ where: { workspaceId: actor.workspaceId } }),
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
          <h1>Olá, {session.user.name}.</h1>
          <p>Organize sua presença pessoal e seu trabalho em um só lugar.</p>
        </div>
        <SignOutButton />
      </div>
      <div className="account-hub">
        <section aria-labelledby="pessoal-heading">
          <div className="account-hub-heading">
            <div>
              <span className="eyebrow">Sua presença</span>
              <h2 id="pessoal-heading">Espaço pessoal</h2>
            </div>
          </div>
          <div className="account-module-grid">
            <Link className="account-module account-module-featured" href="/untrack/smart-pages">
              <strong>Minha página</strong>
              <span>Reúna seus links, perfil e presença pública.</span>
            </Link>
            <div className="account-module account-module-soon" aria-disabled="true">
              <strong>Currículos</strong>
              <span>Em breve</span>
            </div>
            <div className="account-module account-module-soon" aria-disabled="true">
              <strong>Portfólio</strong>
              <span>Em breve</span>
            </div>
          </div>
        </section>
        <section aria-labelledby="profissional-heading">
          <div className="account-hub-heading">
            <div>
              <span className="eyebrow">Distribuição e resultado</span>
              <h2 id="profissional-heading">Trabalho profissional</h2>
            </div>
            <Link href="/untrack/short-links" className="button button-secondary">
              Criar link
            </Link>
          </div>
          <div className="account-module-grid account-module-grid-professional">
            <Link className="account-module" href="/untrack/short-links"><strong>Links rastreáveis</strong><span>Encurte, compartilhe e acompanhe.</span></Link>
            <Link className="account-module" href="/untrack/campaigns"><strong>Campanhas</strong><span>Planeje canais e resultados.</span></Link>
            <Link className="account-module" href="/untrack/utm"><strong>UTMs</strong><span>Padronize seus parâmetros.</span></Link>
            <Link className="account-module" href="/untrack/qr"><strong>QR Codes</strong><span>Leve seus links para o mundo físico.</span></Link>
          </div>
        </section>
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

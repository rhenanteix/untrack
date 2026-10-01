import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { sessionFromHeaders } from "@/lib/session";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
export const metadata = {
  title: "Visão geral",
  robots: { index: false, follow: false },
};
async function overview(userId: string, requestHeaders: Headers) {
  try {
    const actor = await actorFor(userId, requestHeaders),
      db = getPrisma(),
      where = { workspaceId: actor.workspaceId },
      since = new Date(Date.now() - 30 * 86400000);
    const [
      workspace,
      clients,
      campaigns,
      links,
      pages,
      clicks,
      recentLinks,
      recentPages,
      activity,
      incidents,
    ] = await Promise.all([
      db.workspace.findUniqueOrThrow({ where: { id: actor.workspaceId } }),
      db.client.count({ where }),
      db.campaign.count({ where }),
      db.shortLink.count({ where }),
      db.smartPage.count({ where: { ...where, status: "published" } }),
      db.linkClick.count({ where: { link: where, createdAt: { gte: since } } }),
      db.shortLink.findMany({ where, orderBy: { updatedAt: "desc" }, take: 5 }),
      db.smartPage.findMany({ where, orderBy: { updatedAt: "desc" }, take: 5 }),
      db.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: 8 }),
      db.campaignIncident.findMany({
        where: {
          ...where,
          confirmed: true,
          status: { in: ["open", "confirmed"] },
        },
        include: { campaign: { select: { name: true } } },
        orderBy: { updatedAt: "desc" },
        take: 5,
      }),
    ]);
    return {
      ok: true as const,
      actor,
      workspace,
      clients,
      campaigns,
      links,
      pages,
      clicks,
      recentLinks,
      recentPages,
      activity,
      incidents,
    };
  } catch (error) {
    return { ok: false as const, error: workspaceLoadError(error) };
  }
}
const actionNames: Record<string, string> = {
  "smartPage.created": "Página criada",
  "smartPage.updated": "Página atualizada",
  "smartPage.published": "Página publicada",
  "smartPage.unpublished": "Página despublicada",
  "shortLink.created": "Link criado",
  "shortLink.updated": "Link atualizado",
  "campaign.created": "Campanha criada",
  "client.created": "Cliente criado",
  "history.created": "Link processado",
  "smartPage.imageUploaded": "Imagem enviada",
};
export default async function AccountPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/conta");
  const data = await overview(session.user.id, requestHeaders);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const canWrite = data.actor.role !== "viewer";
  return (
    <section className="workspace-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Visão geral</span>
          <h1>{data.workspace.name}</h1>
          <p>Ativos, atividade e próximos passos do seu workspace.</p>
        </div>
        {canWrite && (
          <details className="create-menu">
            <summary className="button">+ Criar</summary>
            <div>
              <Link href="/untrack/short-links?create=1">Link</Link>
              <Link href="/untrack/campaigns?create=1">Campanha</Link>
              <Link href="/untrack/smart-pages?create=1">Smart Page</Link>
              <Link href="/untrack/clients">Cliente</Link>
            </div>
          </details>
        )}
      </header>
      <p className="workspace-data-note">
        Origem: registros do workspace. Cliques dos últimos 30 dias; ativos
        representam o total atual.
      </p>
      <div id="insights" className="workspace-kpis">
        {[
          ["Links", data.links],
          ["Campanhas", data.campaigns],
          ["Páginas publicadas", data.pages],
          ["Cliques · 30 dias", data.clicks],
        ].map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="workspace-overview-grid">
        <section className="workspace-panel">
          <h2>Próximos passos</h2>
          <p>Seu progresso acompanha os registros salvos.</p>
          <ul className="workspace-checklist">
            {[
              ["Criar seu primeiro cliente", data.clients, "/untrack/clients"],
              ["Preparar uma campanha", data.campaigns, "/untrack/campaigns"],
              ["Criar um link", data.links, "/untrack/short-links"],
              ["Publicar sua página", data.pages, "/untrack/smart-pages"],
            ].map(([label, count, href]) => (
              <li key={label}>
                <span aria-label={Number(count) > 0 ? "Concluído" : "Pendente"}>
                  {Number(count) > 0 ? "✓" : "○"}
                </span>
                <Link href={String(href)}>{label}</Link>
              </li>
            ))}
          </ul>
        </section>
        <section className="workspace-panel">
          <h2>Pendências verificadas</h2>
          {data.incidents.length ? (
            <ul>
              {data.incidents.map((item) => (
                <li key={item.id}>
                  <Link href={`/untrack/campaigns/${item.campaignId}`}>
                    {item.campaign.name}
                  </Link>
                  <p>{item.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              Nenhum incidente aberto e confirmado. Isso não substitui uma
              verificação de todos os ativos.
            </p>
          )}
        </section>
        <section className="workspace-panel">
          <h2>Ativos recentes</h2>
          <ul className="workspace-recent">
            {data.recentLinks.map((item) => (
              <li key={item.id}>
                <Link href={`/conta/links/${item.id}`}>
                  {item.title || item.slug}
                </Link>
                <small>Link · {item.isActive ? "Ativo" : "Desativado"}</small>
              </li>
            ))}
            {data.recentPages.map((item) => (
              <li key={item.id}>
                <Link href={`/untrack/smart-pages?edit=${item.id}`}>
                  {item.title}
                </Link>
                <small>
                  Smart Page ·{" "}
                  {item.status === "published" ? "Publicada" : "Não publicada"}
                </small>
              </li>
            ))}
          </ul>
          {!data.recentLinks.length && !data.recentPages.length && (
            <p>Seus links e páginas aparecerão aqui depois de criados.</p>
          )}
        </section>
        <section className="workspace-panel">
          <h2>Atividade recente</h2>
          <ul className="workspace-recent">
            {data.activity.map((item) => (
              <li key={item.id}>
                <span>
                  {actionNames[item.action] ??
                    "Alteração registrada no workspace"}
                </span>
                <time dateTime={item.createdAt.toISOString()}>
                  {item.createdAt.toLocaleString("pt-BR")}
                </time>
              </li>
            ))}
          </ul>
          {!data.activity.length && <p>Nenhuma alteração registrada ainda.</p>}
        </section>
      </div>
    </section>
  );
}

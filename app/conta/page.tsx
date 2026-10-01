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
  const metrics = [
    {
      label: "Links",
      value: data.links,
      detail: "destinos prontos para compartilhar",
    },
    {
      label: "Campanhas",
      value: data.campaigns,
      detail: "iniciativas organizadas no workspace",
    },
    {
      label: "Páginas publicadas",
      value: data.pages,
      detail: "experiências públicas ativas",
    },
    {
      label: "Cliques nos últimos 30 dias",
      value: data.clicks,
      detail: "interações registradas nos seus links",
    },
  ];
  const nextSteps = [
    {
      label: "Criar seu primeiro cliente",
      count: data.clients,
      href: "/untrack/clients",
    },
    {
      label: "Preparar uma campanha",
      count: data.campaigns,
      href: "/untrack/campaigns",
    },
    {
      label: "Criar um link",
      count: data.links,
      href: "/untrack/short-links",
    },
    {
      label: "Publicar uma Smart Page",
      count: data.pages,
      href: "/untrack/smart-pages",
    },
  ];
  return (
    <section className="workspace-page workspace-overview">
      <header className="workspace-page-heading workspace-overview-heading">
        <div>
          <span className="eyebrow">Central de operações</span>
          <h1>{data.workspace.name}</h1>
          <p>
            Acompanhe seus ativos, resolva o que exige atenção e avance para a
            próxima ação.
          </p>
        </div>
        <div className="workspace-heading-actions">
          <Link className="button button-secondary" href="/untrack/short-links">
            Ver links
          </Link>
          {canWrite && (
            <details className="create-menu">
              <summary className="button">Criar</summary>
              <div>
                <Link href="/untrack/short-links?create=1">Novo link</Link>
                <Link href="/untrack/campaigns?create=1">
                  Nova campanha
                </Link>
                <Link href="/untrack/smart-pages?create=1">
                  Nova Smart Page
                </Link>
                <Link href="/untrack/clients">Novo cliente</Link>
              </div>
            </details>
          )}
        </div>
      </header>
      <section className="workspace-snapshot" aria-labelledby="workspace-snapshot-heading">
        <div className="workspace-section-intro">
          <span className="eyebrow">Panorama</span>
          <h2 id="workspace-snapshot-heading">O que está em movimento</h2>
          <p>
            Os números combinam o total atual de ativos com a atividade recente.
          </p>
        </div>
        <dl id="insights" className="workspace-kpis">
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <small>{metric.detail}</small>
            </div>
          ))}
        </dl>
      </section>
      <div className="workspace-priority-grid">
        <section className="workspace-panel workspace-next-steps">
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Próxima ação</span>
              <h2>Organize sua base</h2>
            </div>
            <p>Complete o essencial na ordem que faz sentido para o seu time.</p>
          </div>
          <ol className="workspace-checklist">
            {nextSteps.map((step) => {
              const done = step.count > 0;
              return (
                <li key={step.label}>
                  <span aria-label={done ? "Concluído" : "Pendente"}>
                    {done ? "✓" : "○"}
                  </span>
                  <Link href={step.href}>{step.label}</Link>
                  <small>{done ? "Concluído" : "Pendente"}</small>
                </li>
              );
            })}
          </ol>
        </section>
        <section className="workspace-panel workspace-attention">
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Atenção</span>
              <h2>Itens para acompanhar</h2>
            </div>
            <p>Ocorrências confirmadas pela monitoração das suas campanhas.</p>
          </div>
          {data.incidents.length ? (
            <ul className="workspace-attention-list">
              {data.incidents.map((item) => (
                <li key={item.id}>
                  <div>
                    <Link href={`/untrack/campaigns/${item.campaignId}`}>
                      {item.campaign.name}
                    </Link>
                    <p>{item.message}</p>
                  </div>
                  <Link
                    className="workspace-inline-link"
                    href={`/untrack/campaigns/${item.campaignId}`}
                  >
                    Ver campanha
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="workspace-attention-empty">
              <strong>Nenhuma pendência confirmada.</strong>
              <p>
                As campanhas monitoradas não têm incidentes abertos neste
                momento.
              </p>
            </div>
          )}
        </section>
      </div>
      <div className="workspace-overview-grid workspace-activity-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Retome o trabalho</span>
              <h2>Ativos recentes</h2>
            </div>
            <Link className="workspace-inline-link" href="/untrack/short-links">
              Ver biblioteca
            </Link>
          </div>
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
          <div className="workspace-panel-heading">
            <div>
              <span className="eyebrow">Registro</span>
              <h2>Atividade recente</h2>
            </div>
          </div>
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

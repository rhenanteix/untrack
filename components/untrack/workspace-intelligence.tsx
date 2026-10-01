"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiAlertTriangle, FiArrowRight, FiFolder, FiHeart, FiShield } from "react-icons/fi";
import { apiRequest } from "./shared";

type Resource = { id: string; name: string; description: string; href: string; resourceType: string };
type Dashboard = {
  totals: { links: number; projects: number; campaigns: number; pages: number; linkClicks: number; pageViews: number; pageClicks: number };
  health: { monitored: number; healthy: number; warnings: number; critical: number; incidents: { id: string; message: string; severity: string; campaign: { id: string; name: string } }[] };
  topProjects: { id: string; name: string; color: string; _count: { resources: number } }[];
  opportunities: { id: string; count: number; label: string; action: string; href: string }[];
  activity: { id: string; action: string; createdAt: string }[];
  favorites: Resource[];
  recent: Resource[];
};

const actionNames: Record<string, string> = {
  "project.created": "Projeto criado",
  "project.archived": "Projeto arquivado",
  "project.restored": "Projeto restaurado",
  "resource.addedToProject": "Recurso adicionado ao projeto",
  "tag.applied": "Tags atualizadas",
  "collection.created": "Collection criada",
  "favorite.added": "Favorito adicionado",
  "smartPage.published": "Smart Page publicada",
  "shortLink.created": "Link criado",
  "campaign.created": "Campanha criada",
};

export function WorkspaceIntelligence() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Dashboard>("/api/workspace-dashboard", { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, []);

  if (error)
    return (
      <section className="workspace-panel intelligence-error" role="alert">
        <h2>Não foi possível carregar a inteligência do workspace</h2>
        <p>{error}</p>
      </section>
    );
  if (!data)
    return <section className="workspace-panel intelligence-loading" role="status">Carregando contexto do workspace...</section>;

  const metrics = [
    { label: "Projetos", value: data.totals.projects, detail: "contextos ativos" },
    { label: "Links", value: data.totals.links, detail: "destinos digitais" },
    { label: "Cliques", value: data.totals.linkClicks, detail: "nos últimos 30 dias" },
    { label: "Views", value: data.totals.pageViews, detail: "Smart Pages nos últimos 30 dias" },
  ];
  return (
    <div className="workspace-intelligence">
      <section className="intelligence-summary">
        <div>
          <span className="eyebrow">Workspace intelligence</span>
          <h2>O que importa agora</h2>
          <p>Visão consolidada dos ativos, monitoramento e próximas ações.</p>
        </div>
        <dl>
          {metrics.map((metric) => (
            <div key={metric.label}>
              <dt>{metric.label}</dt>
              <dd>{metric.value}</dd>
              <small>{metric.detail}</small>
            </div>
          ))}
        </dl>
      </section>

      <div className="intelligence-grid">
        <section className="workspace-panel intelligence-projects">
          <div className="workspace-panel-heading">
            <div><span className="eyebrow">Contexto</span><h2>Projetos em foco</h2></div>
            <Link className="workspace-inline-link" href="/untrack/projects">Ver todos</Link>
          </div>
          {data.topProjects.length ? (
            <ul>
              {data.topProjects.map((project) => (
                <li key={project.id}>
                  <span className="intelligence-project-icon" style={{ backgroundColor: project.color }}><FiFolder aria-hidden="true" /></span>
                  <Link href={`/untrack/projects/${project.id}`}>{project.name}</Link>
                  <small>{project._count.resources} recurso(s)</small>
                </li>
              ))}
            </ul>
          ) : <p>Crie um projeto quando quiser reunir uma iniciativa em um só contexto.</p>}
        </section>
        <section className="workspace-panel intelligence-health">
          <div className="workspace-panel-heading">
            <div><span className="eyebrow">Monitoramento</span><h2>Health do workspace</h2></div>
            <FiShield aria-hidden="true" />
          </div>
          <dl>
            <div><dt>Checks saudáveis</dt><dd>{data.health.healthy}</dd></div>
            <div><dt>Avisos</dt><dd>{data.health.warnings}</dd></div>
            <div><dt>Críticos</dt><dd>{data.health.critical}</dd></div>
          </dl>
          <p>{data.health.monitored ? `${data.health.monitored} campanha(s) com monitoramento registrado.` : "Ative o monitoramento em campanhas importantes para acompanhar a saúde."}</p>
          {data.health.incidents.slice(0, 2).map((incident) => (
            <Link className="intelligence-incident" href={`/untrack/campaigns/${incident.campaign.id}`} key={incident.id}>
              <FiAlertTriangle aria-hidden="true" /> {incident.message}
            </Link>
          ))}
        </section>
      </div>

      <div className="intelligence-grid intelligence-lower-grid">
        <section className="workspace-panel">
          <div className="workspace-panel-heading"><div><span className="eyebrow">Oportunidades</span><h2>Próximas ações</h2></div></div>
          {data.opportunities.length ? <ul className="intelligence-list">{data.opportunities.map((item) => <li key={item.id}><span><strong>{item.count}</strong> {item.label}</span><Link href={item.href}>{item.action} <FiArrowRight aria-hidden="true" /></Link></li>)}</ul> : <p>Nenhuma oportunidade pendente no momento.</p>}
        </section>
        <section className="workspace-panel">
          <div className="workspace-panel-heading"><div><span className="eyebrow">Acesso rápido</span><h2>Favoritos e recentes</h2></div><FiHeart aria-hidden="true" /></div>
          <ul className="intelligence-resources">
            {[...data.favorites, ...data.recent].slice(0, 6).map((item) => <li key={`${item.resourceType}:${item.id}`}><Link href={item.href}>{item.name}</Link><small>{item.resourceType}</small></li>)}
          </ul>
          {!data.favorites.length && !data.recent.length ? <p>Seus favoritos e recursos visitados aparecerão aqui.</p> : null}
        </section>
      </div>

      <section className="workspace-panel intelligence-activity">
        <div className="workspace-panel-heading"><div><span className="eyebrow">Registro</span><h2>Atividade recente</h2></div></div>
        <ul className="intelligence-list">
          {data.activity.slice(0, 6).map((item) => <li key={item.id}><span>{actionNames[item.action] ?? "Alteração registrada"}</span><time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString("pt-BR")}</time></li>)}
        </ul>
      </section>
    </div>
  );
}
"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FiArchive, FiFolder, FiHeart, FiRotateCcw } from "react-icons/fi";
import { apiRequest, ActionStatus, useAction } from "./shared";
import { useWorkspace } from "./shell";
import { ProjectResourceManager } from "./project-resource-manager";
import { ProjectMembersManager } from "./project-members-manager";

type Project = {
  id: string;
  name: string;
  description: string;
  color: string;
  status: "active" | "archived";
  archivedAt: string | null;
  updatedAt: string;
  _count: { resources: number };
};

type ProjectInsights = {
  resourceCounts: Record<string, number>;
  analytics: { linkClicks: number; pageViews: number; pageClicks: number; since: string };
  health: { monitored: number; healthy: number; warnings: number; critical: number };
};

export function ProjectOverview({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const workspace = useWorkspace();
  const canWrite = workspace?.role !== "viewer";
  const canManage = ["owner", "admin"].includes(workspace?.role ?? "");
  const action = useAction();
  const [project, setProject] = useState<Project | null>(null);
  const [insights, setInsights] = useState<ProjectInsights | null>(null);
  const [favorite, setFavorite] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<Project>(`/api/projects/${id}`, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setProject(data);
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: Array<{ id: string; resourceType: string }> }>(
      "/api/resources?action=favorites",
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted)
          setFavorite(data.items.some((item) => item.id === id && item.resourceType === "project"));
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<ProjectInsights>(`/api/projects/${id}/insights`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setInsights(data);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [id]);

  async function changeStatus() {
    if (!project) return;
    const archive = project.status === "active";
    if (
      !window.confirm(
        archive
          ? `Arquivar ${project.name}? Seus recursos continuarão preservados.`
          : `Restaurar ${project.name}?`,
      )
    )
      return;
    await action.run(async () => {
      const result = await apiRequest<Project | { project: Project }>(
        `/api/projects/${project.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: archive ? "archive" : "restore" }),
        },
      );
      setProject("project" in result ? result.project : result);
      action.setNotice(archive ? "Projeto arquivado." : "Projeto restaurado.");
    });
  }

  if (error)
    return (
      <section className="workspace-page">
        <div className="workspace-panel" role="alert">
          <h1>Não foi possível abrir este projeto</h1>
          <p>{error}</p>
          <Link className="button button-secondary" href="/untrack/projects">
            Voltar aos projetos
          </Link>
        </div>
      </section>
    );

  if (!project)
    return (
      <section className="workspace-page">
        <p role="status">Carregando projeto...</p>
      </section>
    );

  return (
    <section className="workspace-page project-overview-page">
      <Link className="back-link" href="/untrack/projects">
        ← Projetos
      </Link>
      <header className="workspace-page-heading project-overview-heading">
        <div>
          <span className="project-title-icon" style={{ backgroundColor: project.color }}>
            <FiFolder aria-hidden="true" />
          </span>
          <span className="eyebrow">Projeto</span>
          <h1>{project.name}</h1>
          <p>{project.description || "Defina o objetivo desta iniciativa quando fizer sentido."}</p>
        </div>
        {canWrite && <div className="project-overview-actions"><button className="project-favorite" type="button" title={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} aria-label={favorite ? "Remover dos favoritos" : "Adicionar aos favoritos"} disabled={action.busy} onClick={() => void action.run(async () => { const result = await apiRequest<{ favorite: boolean }>("/api/resources", { method: "POST", body: JSON.stringify({ action: "favorite", resourceType: "project", resourceId: project.id }) }); setFavorite(result.favorite); action.setNotice(result.favorite ? "Projeto favoritado." : "Projeto removido dos favoritos."); })}><FiHeart aria-hidden="true" /></button><button className="button button-secondary" disabled={action.busy} onClick={() => void changeStatus()}>{project.status === "active" ? <FiArchive aria-hidden="true" /> : <FiRotateCcw aria-hidden="true" />}{project.status === "active" ? "Arquivar" : "Restaurar"}</button></div>}
      </header>
      <ActionStatus {...action} />
      <section className="project-snapshot" aria-labelledby="project-snapshot-title">
        <div>
          <span className="eyebrow">Snapshot</span>
          <h2 id="project-snapshot-title">O estado atual</h2>
        </div>
        <dl>
          <div>
            <dt>Recursos conectados</dt>
            <dd>{project._count.resources}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{project.status === "active" ? "Ativo" : "Arquivado"}</dd>
          </div>
          <div>
            <dt>Última atualização</dt>
            <dd>{new Date(project.updatedAt).toLocaleDateString("pt-BR")}</dd>
          </div>
        </dl>
      </section>
      {insights && (
        <section className="project-insights" aria-labelledby="project-insights-title">
          <div>
            <span className="eyebrow">Sinais reais</span>
            <h2 id="project-insights-title">Alcance e saúde</h2>
          </div>
          <dl>
            <div><dt>Cliques em links</dt><dd>{insights.analytics.linkClicks}</dd><small>últimos 30 dias</small></div>
            <div><dt>Views de páginas</dt><dd>{insights.analytics.pageViews}</dd><small>últimos 30 dias</small></div>
            <div><dt>Checks saudáveis</dt><dd>{insights.health.healthy}</dd><small>{insights.health.monitored} campanha(s) monitorada(s)</small></div>
            <div><dt>Incidentes abertos</dt><dd>{insights.health.warnings + insights.health.critical}</dd><small>{insights.health.critical} crítico(s)</small></div>
          </dl>
        </section>
      )}
      <ProjectResourceManager projectId={project.id} canWrite={canWrite} />
      {canManage && <ProjectMembersManager projectId={project.id} />}
    </section>
  );
}
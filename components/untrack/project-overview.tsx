"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { FiArchive, FiFolder, FiRotateCcw } from "react-icons/fi";
import { apiRequest, ActionStatus, useAction } from "./shared";
import { useWorkspace } from "./shell";

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

export function ProjectOverview({
  params: paramsPromise,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);
  const workspace = useWorkspace();
  const canWrite = workspace?.role !== "viewer";
  const action = useAction();
  const [project, setProject] = useState<Project | null>(null);
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
        {canWrite && (
          <button
            className="button button-secondary"
            disabled={action.busy}
            onClick={() => void changeStatus()}
          >
            {project.status === "active" ? (
              <FiArchive aria-hidden="true" />
            ) : (
              <FiRotateCcw aria-hidden="true" />
            )}
            {project.status === "active" ? "Arquivar" : "Restaurar"}
          </button>
        )}
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
      <section className="workspace-panel project-resources-empty">
        <h2>Recursos</h2>
        <p>
          A associação de links, campanhas, Smart Pages, UTMs e QR Codes será
          adicionada aqui sem duplicar os registros existentes.
        </p>
      </section>
    </section>
  );
}
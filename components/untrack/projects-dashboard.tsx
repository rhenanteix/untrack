"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FiArchive,
  FiFolder,
  FiPlus,
  FiRefreshCw,
  FiRotateCcw,
} from "react-icons/fi";
import { apiRequest, ActionStatus, useAction } from "./shared";
import { useWorkspace } from "./shell";

type Project = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  status: "active" | "archived";
  updatedAt: string;
  archivedAt: string | null;
  _count: { resources: number };
};

type ProjectList = {
  items: Project[];
  page: number;
  hasMore: boolean;
};

function iconLabel(icon: string) {
  return icon === "target" ? "Alvo" : icon === "spark" ? "Destaque" : "Pasta";
}

export function ProjectsDashboard() {
  const workspace = useWorkspace();
  const canWrite = workspace?.role !== "viewer";
  const createDialog = useRef<HTMLDialogElement>(null);
  const action = useAction();
  const [query, setQuery] = useState({ search: "", status: "active", page: 1 });
  const [draftSearch, setDraftSearch] = useState("");
  const [result, setResult] = useState<ProjectList | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      search: query.search,
      status: query.status,
      page: String(query.page),
    });
    apiRequest<ProjectList>(`/api/projects?${params}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult(data);
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) {
          setResult(null);
          setError(loadError.message);
        }
      });
    return () => controller.abort();
  }, [query]);

  async function refresh() {
    setQuery((current) => ({ ...current }));
  }

  async function submitProject(form: HTMLFormElement) {
    const data = new FormData(form);
    await action.run(async () => {
      await apiRequest("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          description: data.get("description"),
          icon: data.get("icon"),
          color: data.get("color"),
        }),
      });
      createDialog.current?.close();
      form.reset();
      setQuery({ search: "", status: "active", page: 1 });
      action.setNotice("Projeto criado.");
    });
  }

  async function setArchiveState(project: Project) {
    const archive = project.status === "active";
    const confirmed = window.confirm(
      archive
        ? `Arquivar ${project.name}? ${project._count.resources} recurso(s) continuarão preservados.`
        : `Restaurar ${project.name}?`,
    );
    if (!confirmed) return;
    await action.run(async () => {
      await apiRequest(`/api/projects/${project.id}`, {
        method: "PATCH",
        body: JSON.stringify({ action: archive ? "archive" : "restore" }),
      });
      await refresh();
      action.setNotice(archive ? "Projeto arquivado." : "Projeto restaurado.");
    });
  }

  return (
    <section className="workspace-page projects-page">
      <header className="workspace-page-heading projects-heading">
        <div>
          <span className="eyebrow">Contexto de trabalho</span>
          <h1>Projetos</h1>
          <p>
            Reúna links, campanhas, páginas e resultados em torno de uma
            iniciativa, sem criar pastas em cascata.
          </p>
        </div>
        {canWrite && (
          <button
            className="button"
            type="button"
            onClick={() => createDialog.current?.showModal()}
          >
            <FiPlus aria-hidden="true" /> Novo projeto
          </button>
        )}
      </header>

      <div className="projects-toolbar">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQuery({ search: draftSearch, status: query.status, page: 1 });
          }}
        >
          <label>
            Buscar projetos
            <input
              value={draftSearch}
              maxLength={120}
              placeholder="Nome ou descrição"
              onChange={(event) => setDraftSearch(event.target.value)}
            />
          </label>
          <button className="button button-secondary">Buscar</button>
        </form>
        <label>
          Mostrar
          <select
            value={query.status}
            onChange={(event) =>
              setQuery({
                search: query.search,
                status: event.target.value,
                page: 1,
              })
            }
          >
            <option value="active">Ativos</option>
            <option value="archived">Arquivados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>

      <ActionStatus {...action} />

      {error ? (
        <section className="workspace-panel projects-empty" role="alert">
          <h2>Não foi possível carregar seus projetos</h2>
          <p>{error}</p>
          <button className="button button-secondary" onClick={() => void refresh()}>
            <FiRefreshCw aria-hidden="true" /> Tentar novamente
          </button>
        </section>
      ) : !result ? (
        <section className="workspace-panel projects-empty" role="status">
          <p>Carregando projetos...</p>
        </section>
      ) : result.items.length ? (
        <div className="projects-grid">
          {result.items.map((project) => (
            <article className="project-card" key={project.id}>
              <div className="project-card-heading">
                <span
                  className="project-icon"
                  style={{ backgroundColor: project.color }}
                  aria-label={iconLabel(project.icon)}
                >
                  <FiFolder aria-hidden="true" />
                </span>
                <span className={`project-status project-status-${project.status}`}>
                  {project.status === "active" ? "Ativo" : "Arquivado"}
                </span>
              </div>
              <Link href={`/untrack/projects/${project.id}`}>
                <h2>{project.name}</h2>
              </Link>
              <p>{project.description || "Sem descrição por enquanto."}</p>
              <dl>
                <div>
                  <dt>Recursos</dt>
                  <dd>{project._count.resources}</dd>
                </div>
                <div>
                  <dt>Atualizado</dt>
                  <dd>
                    {new Date(project.updatedAt).toLocaleDateString("pt-BR")}
                  </dd>
                </div>
              </dl>
              {canWrite && (
                <button
                  className="project-card-action"
                  type="button"
                  title={
                    project.status === "active"
                      ? "Arquivar projeto"
                      : "Restaurar projeto"
                  }
                  aria-label={
                    project.status === "active"
                      ? `Arquivar ${project.name}`
                      : `Restaurar ${project.name}`
                  }
                  disabled={action.busy}
                  onClick={() => void setArchiveState(project)}
                >
                  {project.status === "active" ? (
                    <FiArchive aria-hidden="true" />
                  ) : (
                    <FiRotateCcw aria-hidden="true" />
                  )}
                </button>
              )}
            </article>
          ))}
        </div>
      ) : (
        <section className="workspace-panel projects-empty">
          <FiFolder aria-hidden="true" />
          <h2>
            {query.search || query.status !== "active"
              ? "Nenhum projeto encontrado"
              : "Dê contexto ao que você está construindo"}
          </h2>
          <p>
            {query.search || query.status !== "active"
              ? "Ajuste a busca ou altere o filtro para encontrar outro projeto."
              : "Projetos organizam links, campanhas e Smart Pages em torno de uma meta, sem obrigar você a reorganizar tudo."}
          </p>
          {canWrite && !query.search && query.status === "active" && (
            <button
              className="button"
              type="button"
              onClick={() => createDialog.current?.showModal()}
            >
              <FiPlus aria-hidden="true" /> Criar primeiro projeto
            </button>
          )}
        </section>
      )}

      {result && result.items.length > 0 && (
        <nav className="projects-pagination" aria-label="Paginação de projetos">
          <button
            className="button button-secondary"
            disabled={result.page === 1}
            onClick={() =>
              setQuery((current) => ({ ...current, page: current.page - 1 }))
            }
          >
            Anterior
          </button>
          <span>Página {result.page}</span>
          <button
            className="button button-secondary"
            disabled={!result.hasMore}
            onClick={() =>
              setQuery((current) => ({ ...current, page: current.page + 1 }))
            }
          >
            Próxima
          </button>
        </nav>
      )}

      <dialog className="project-dialog" ref={createDialog}>
        <form
          className="account-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submitProject(event.currentTarget);
          }}
        >
          <div className="project-dialog-heading">
            <div>
              <span className="eyebrow">Novo projeto</span>
              <h2>Crie um contexto de trabalho</h2>
            </div>
            <button
              className="project-dialog-close"
              type="button"
              aria-label="Fechar criação de projeto"
              title="Fechar"
              onClick={() => createDialog.current?.close()}
            >
              ×
            </button>
          </div>
          <label>
            Nome
            <input autoFocus required name="name" maxLength={120} />
          </label>
          <label>
            Descrição opcional
            <textarea name="description" maxLength={500} rows={3} />
          </label>
          <div className="project-appearance-fields">
            <label>
              Ícone
              <select name="icon" defaultValue="folder">
                <option value="folder">Pasta</option>
                <option value="target">Alvo</option>
                <option value="spark">Destaque</option>
              </select>
            </label>
            <label>
              Cor
              <input
                aria-label="Cor do projeto"
                name="color"
                type="color"
                defaultValue="#285239"
              />
            </label>
          </div>
          <div className="project-dialog-actions">
            <button
              className="button button-secondary"
              type="button"
              onClick={() => createDialog.current?.close()}
            >
              Cancelar
            </button>
            <button className="button" disabled={action.busy}>
              Criar projeto
            </button>
          </div>
        </form>
      </dialog>
    </section>
  );
}
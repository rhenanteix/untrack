"use client";

import { useEffect, useState } from "react";
import { FiArchive, FiPlus, FiRotateCcw, FiTag } from "react-icons/fi";
import { ActionStatus, apiRequest, useAction } from "./shared";
import { useWorkspace } from "./shell";

type Tag = {
  id: string;
  name: string;
  color: string;
  archivedAt: string | null;
  _count: { resources: number };
};

export function TagsDashboard() {
  const workspace = useWorkspace();
  const canWrite = workspace?.role !== "viewer";
  const action = useAction();
  const [tags, setTags] = useState<Tag[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ tags: Tag[] }>(`/api/tags?archived=${showArchived}`, {
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setTags(result.tags);
          setError("");
        }
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, [showArchived, revision]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  return (
    <section className="workspace-page intelligence-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Organização global</span>
          <h1>Tags</h1>
          <p>Use tags para encontrar recursos por tema, canal ou prioridade.</p>
        </div>
        <label className="tags-archive-toggle">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
          />
          Mostrar arquivadas
        </label>
      </header>
      {canWrite && (
        <form
          className="workspace-panel intelligence-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void action.run(async () => {
              await apiRequest("/api/tags", {
                method: "POST",
                body: JSON.stringify({
                  name: data.get("name"),
                  color: data.get("color"),
                }),
              });
              form.reset();
              refresh();
              action.setNotice("Tag criada.");
            });
          }}
        >
          <label>
            Nome
            <input name="name" required maxLength={80} placeholder="instagram" />
          </label>
          <label>
            Cor
            <input
              name="color"
              type="color"
              defaultValue="#285239"
              aria-label="Cor da tag"
            />
          </label>
          <button className="button" disabled={action.busy}>
            <FiPlus aria-hidden="true" /> Criar tag
          </button>
        </form>
      )}
      <ActionStatus {...action} />
      {error && (
        <section className="workspace-panel" role="alert">
          <h2>Não foi possível carregar as tags</h2>
          <p>{error}</p>
          <button className="button button-secondary" onClick={refresh}>
            Tentar novamente
          </button>
        </section>
      )}
      {!error && !tags.length && (
        <section className="workspace-panel intelligence-empty">
          <FiTag aria-hidden="true" />
          <h2>{showArchived ? "Nenhuma tag arquivada" : "Comece com uma tag útil"}</h2>
          <p>Tags ajudam a conectar recursos sem obrigar uma estrutura de pastas.</p>
        </section>
      )}
      <div className="tags-grid">
        {tags.map((tag) => (
          <article className="tag-card" key={tag.id}>
            <span className="tag-color" style={{ backgroundColor: tag.color }} aria-hidden="true" />
            <div>
              <h2>{tag.name}</h2>
              <p>{tag._count.resources} recurso(s)</p>
            </div>
            {canWrite && (
              <button
                type="button"
                title={tag.archivedAt ? "Restaurar tag" : "Arquivar tag"}
                aria-label={`${tag.archivedAt ? "Restaurar" : "Arquivar"} ${tag.name}`}
                onClick={() =>
                  void action.run(async () => {
                    await apiRequest(`/api/tags/${tag.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({ archived: !tag.archivedAt }),
                    });
                    refresh();
                    action.setNotice(
                      tag.archivedAt ? "Tag restaurada." : "Tag arquivada.",
                    );
                  })
                }
              >
                {tag.archivedAt ? <FiRotateCcw aria-hidden="true" /> : <FiArchive aria-hidden="true" />}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
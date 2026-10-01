"use client";

import { useEffect, useState } from "react";
import { FiChevronDown, FiChevronUp, FiFolderPlus, FiPlus, FiX } from "react-icons/fi";
import { ActionStatus, apiRequest, useAction } from "./shared";
import { useWorkspace } from "./shell";

type Project = { id: string; name: string };
type Resource = {
  id: string;
  resourceType: string;
  name: string;
  description: string;
  href: string;
  collectionResourceId?: string;
};
type Collection = {
  id: string;
  name: string;
  description: string;
  kind: "manual" | "smart";
  project?: Project | null;
  _count: { resources: number };
};

export function CollectionsDashboard() {
  const workspace = useWorkspace();
  const canWrite = workspace?.role !== "viewer";
  const action = useAction();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selected, setSelected] = useState<Collection | null>(null);
  const [items, setItems] = useState<Resource[]>([]);
  const [options, setOptions] = useState<Resource[]>([]);
  const [kind, setKind] = useState<"manual" | "smart">("manual");
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ items: Collection[] }>("/api/collections", {
        signal: controller.signal,
      }),
      apiRequest<{ items: Project[] }>("/api/projects?status=all", {
        signal: controller.signal,
      }),
      apiRequest<{ items: Resource[] }>("/api/resources", {
        signal: controller.signal,
      }),
    ])
      .then(([collectionResult, projectResult, resourceResult]) => {
        if (!controller.signal.aborted) {
          setCollections(collectionResult.items);
          setProjects(projectResult.items);
          setOptions(resourceResult.items);
          setError("");
        }
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, [revision]);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    apiRequest<{ collection: Collection; items: Resource[] }>(
      `/api/collections/${selected.id}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setItems(result.items);
      })
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      });
    return () => controller.abort();
  }, [selected, revision]);

  function refresh() {
    setRevision((value) => value + 1);
  }

  function reorder(itemId: string, direction: -1 | 1) {
    const ids = items.map((item) => item.collectionResourceId).filter((id): id is string => !!id);
    const index = ids.indexOf(itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length || !selected) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void action.run(async () => {
      await apiRequest(`/api/collections/${selected.id}/resources`, {
        method: "PATCH",
        body: JSON.stringify({ ids }),
      });
      refresh();
      action.setNotice("Ordem da collection atualizada.");
    });
  }

  const availableOptions = options.filter(
    (option) =>
      !items.some(
        (item) =>
          item.resourceType === option.resourceType && item.id === option.id,
      ),
  );

  return (
    <section className="workspace-page intelligence-page">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Agrupamento opcional</span>
          <h1>Collections</h1>
          <p>Crie grupos úteis dentro ou fora de um Project, sem competir com seu contexto de trabalho.</p>
        </div>
      </header>
      {canWrite && (
        <form
          className="workspace-panel intelligence-create-form collection-create"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const data = new FormData(form);
            void action.run(async () => {
              await apiRequest("/api/collections", {
                method: "POST",
                body: JSON.stringify({
                  name: data.get("name"),
                  description: data.get("description"),
                  projectId: data.get("projectId") || null,
                  kind: data.get("kind"),
                  rules:
                    data.get("kind") === "smart" && data.get("ruleValue")
                      ? [{ field: data.get("ruleField"), operator: "contains", value: data.get("ruleValue") }]
                      : [],
                }),
              });
              form.reset();
              refresh();
              action.setNotice("Collection criada.");
            });
          }}
        >
          <label>Nome<input required name="name" maxLength={120} placeholder="Ofertas principais" /></label>
          <label>Descrição<input name="description" maxLength={500} /></label>
          <label>Projeto<select name="projectId"><option value="">Sem projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
          <label>Tipo<select name="kind" value={kind} onChange={(event) => setKind(event.target.value as "manual" | "smart")}><option value="manual">Manual</option><option value="smart">Inteligente</option></select></label>
          {kind === "smart" && <><label>Filtrar por<select name="ruleField"><option value="resourceType">Tipo de recurso</option><option value="name">Nome</option><option value="tag">Tag</option></select></label><label>Contém<input name="ruleValue" required maxLength={120} placeholder="campanha" /></label></>}
          <button className="button" disabled={action.busy}><FiFolderPlus aria-hidden="true" /> Criar collection</button>
        </form>
      )}
      <ActionStatus {...action} />
      {error && <section className="workspace-panel" role="alert"><h2>Não foi possível carregar collections</h2><p>{error}</p></section>}
      <div className="collections-layout">
        <div className="collections-list">
          {!collections.length && !error && <section className="workspace-panel intelligence-empty"><FiFolderPlus aria-hidden="true" /><h2>Crie um agrupamento quando ele ajudar</h2><p>Collections são opcionais: use-as para destacar um conjunto de recursos dentro de uma iniciativa.</p></section>}
          {collections.map((collection) => <button type="button" className={`collection-card${selected?.id === collection.id ? " is-selected" : ""}`} key={collection.id} onClick={() => setSelected(collection)}><strong>{collection.name}</strong><span>{collection.kind === "smart" ? "Inteligente" : "Manual"}</span><small>{collection.project?.name ?? "Workspace"} · {collection._count.resources} recurso(s)</small></button>)}
        </div>
        {selected && <aside className="workspace-panel collection-detail"><div className="workspace-panel-heading"><div><span className="eyebrow">{selected.kind === "smart" ? "Atualização por regras" : "Itens conectados"}</span><h2>{selected.name}</h2></div><button type="button" className="collection-close" title="Fechar collection" aria-label="Fechar collection" onClick={() => setSelected(null)}><FiX aria-hidden="true" /></button></div><p>{selected.description || "Sem descrição."}</p>{selected.kind === "manual" && canWrite && <form className="collection-add" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("resource")?.toString() ?? ""; const [resourceType, resourceId] = value.split(":"); if (!resourceType || !resourceId) return; void action.run(async () => { await apiRequest(`/api/collections/${selected.id}/resources`, { method: "POST", body: JSON.stringify({ resourceType, resourceId }) }); refresh(); action.setNotice("Recurso adicionado à collection."); }); }}><label>Adicionar recurso<select name="resource" defaultValue=""><option value="" disabled>Selecione um recurso</option>{availableOptions.map((item) => <option key={`${item.resourceType}:${item.id}`} value={`${item.resourceType}:${item.id}`}>{item.name} · {item.resourceType}</option>)}</select></label><button className="button button-secondary" disabled={action.busy || !availableOptions.length}><FiPlus aria-hidden="true" /> Adicionar</button></form>}<ul className="collection-items">{items.map((item, index) => <li key={item.collectionResourceId ?? `${item.resourceType}:${item.id}`}><span><strong>{item.name}</strong><small>{item.resourceType} · {item.description}</small></span>{selected.kind === "manual" && canWrite && item.collectionResourceId && <div className="collection-item-actions"><button type="button" title="Mover para cima" aria-label={`Mover ${item.name} para cima`} disabled={index === 0 || action.busy} onClick={() => reorder(item.collectionResourceId!, -1)}><FiChevronUp aria-hidden="true" /></button><button type="button" title="Mover para baixo" aria-label={`Mover ${item.name} para baixo`} disabled={index === items.length - 1 || action.busy} onClick={() => reorder(item.collectionResourceId!, 1)}><FiChevronDown aria-hidden="true" /></button><button type="button" title="Remover da collection" aria-label={`Remover ${item.name} da collection`} disabled={action.busy} onClick={() => void action.run(async () => { await apiRequest(`/api/collections/${selected.id}/resources`, { method: "DELETE", body: JSON.stringify({ itemId: item.collectionResourceId! }) }); refresh(); action.setNotice("Recurso removido da collection."); })}><FiX aria-hidden="true" /></button></div>}</li>)}{!items.length && <li>{selected.kind === "smart" ? "Nenhum recurso corresponde às regras desta collection." : "Sem recursos conectados."}</li>}</ul></aside>}
      </div>
    </section>
  );
}
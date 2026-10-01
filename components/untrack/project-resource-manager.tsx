"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FiHeart, FiPlus, FiX } from "react-icons/fi";
import { ActionStatus, apiRequest, useAction } from "./shared";

type Resource = {
  id: string;
  resourceType: string;
  name: string;
  description: string;
  href: string;
};
type Collection = { id: string; name: string; kind: string; _count: { resources: number } };
type Tag = { id: string; name: string; color: string };

export function ProjectResourceManager({ projectId, canWrite }: { projectId: string; canWrite: boolean }) {
  const action = useAction();
  const [items, setItems] = useState<Resource[]>([]);
  const [options, setOptions] = useState<Resource[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [resourceTags, setResourceTags] = useState<Record<string, string[]>>({});
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      apiRequest<{ items: Resource[] }>(`/api/projects/${projectId}/resources`, { signal: controller.signal }),
      apiRequest<{ items: Resource[] }>("/api/resources", { signal: controller.signal }),
      apiRequest<{ items: Collection[] }>(`/api/collections?projectId=${projectId}`, { signal: controller.signal }),
      apiRequest<{ tags: Tag[] }>("/api/tags", { signal: controller.signal }),
      apiRequest("/api/resources", { method: "POST", body: JSON.stringify({ action: "recent", resourceType: "project", resourceId: projectId }), signal: controller.signal }),
    ])
      .then(async ([resourceResult, optionResult, collectionResult, tagResult]) => {
        const tagPairs = await Promise.all(
          resourceResult.items.map(async (item) => ({
            key: `${item.resourceType}:${item.id}`,
            result: await apiRequest<{ tags: Tag[] }>(`/api/resources?action=tags&resourceType=${encodeURIComponent(item.resourceType)}&resourceId=${encodeURIComponent(item.id)}`, { signal: controller.signal }),
          })),
        );
        if (!controller.signal.aborted) {
          setItems(resourceResult.items);
          setOptions(optionResult.items);
          setCollections(collectionResult.items);
          setTags(tagResult.tags);
          setResourceTags(Object.fromEntries(tagPairs.map(({ key, result }) => [key, result.tags.map((tag) => tag.id)])));
          setError("");
        }
      })
      .catch((loadError: Error) => { if (!controller.signal.aborted) setError(loadError.message); });
    return () => controller.abort();
  }, [projectId, revision]);

  function refresh() { setRevision((value) => value + 1); }

  function updateTags(item: Resource, tagIds: string[]) {
    void action.run(async () => {
      await apiRequest("/api/resources", {
        method: "POST",
        body: JSON.stringify({ action: "set-tags", resourceType: item.resourceType, resourceId: item.id, tagIds }),
      });
      setResourceTags((current) => ({ ...current, [`${item.resourceType}:${item.id}`]: tagIds }));
      action.setNotice("Tags atualizadas.");
    });
  }

  const availableOptions = options.filter(
    (option) =>
      !items.some(
        (item) =>
          item.resourceType === option.resourceType && item.id === option.id,
      ),
  );

  return <div className="project-resource-manager">
    <ActionStatus {...action} />
    {error && <section className="workspace-panel" role="alert"><h2>Não foi possível carregar recursos</h2><p>{error}</p></section>}
    <section className="workspace-panel project-resources-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">Recursos conectados</span><h2>Trabalhe no contexto</h2></div><div className="project-export-actions"><a className="workspace-inline-link" href={`/api/projects/${projectId}/export?format=csv`}>CSV</a><a className="workspace-inline-link" href={`/api/projects/${projectId}/export?format=json`}>JSON</a></div></div>{canWrite && <form className="collection-add" onSubmit={(event) => { event.preventDefault(); const value = new FormData(event.currentTarget).get("resource")?.toString() ?? ""; const [resourceType, resourceId] = value.split(":"); if (!resourceType || !resourceId) return; void action.run(async () => { await apiRequest(`/api/projects/${projectId}/resources`, { method: "POST", body: JSON.stringify({ resourceType, resourceId }) }); refresh(); action.setNotice("Recurso conectado ao projeto."); }); }}><label>Adicionar recurso<select name="resource" defaultValue=""><option value="" disabled>Selecione um recurso</option>{availableOptions.map((item) => <option key={`${item.resourceType}:${item.id}`} value={`${item.resourceType}:${item.id}`}>{item.name} · {item.resourceType}</option>)}</select></label><button className="button button-secondary" disabled={action.busy || !availableOptions.length}><FiPlus aria-hidden="true" /> Adicionar</button></form>}<ul className="collection-items project-resource-list">{items.map((item) => <li key={`${item.resourceType}:${item.id}`}><span><Link href={item.href}>{item.name}</Link><small>{item.resourceType} · {item.description}</small>{canWrite && tags.length ? <details className="resource-tags"><summary>Tags ({resourceTags[`${item.resourceType}:${item.id}`]?.length ?? 0})</summary><div>{tags.map((tag) => { const selected = resourceTags[`${item.resourceType}:${item.id}`]?.includes(tag.id) ?? false; return <label key={tag.id}><input type="checkbox" checked={selected} onChange={() => { const current = resourceTags[`${item.resourceType}:${item.id}`] ?? []; updateTags(item, selected ? current.filter((id) => id !== tag.id) : [...current, tag.id]); }} /><i style={{ backgroundColor: tag.color }} aria-hidden="true" />{tag.name}</label>; })}</div></details> : null}</span><div>{canWrite && <button type="button" title="Favoritar recurso" aria-label={`Favoritar ${item.name}`} onClick={() => void action.run(async () => { await apiRequest("/api/resources", { method: "POST", body: JSON.stringify({ action: "favorite", resourceType: item.resourceType, resourceId: item.id }) }); action.setNotice("Favorito atualizado."); })}><FiHeart aria-hidden="true" /></button>}{canWrite && <button type="button" title="Remover do projeto" aria-label={`Remover ${item.name} do projeto`} onClick={() => void action.run(async () => { await apiRequest(`/api/projects/${projectId}/resources`, { method: "DELETE", body: JSON.stringify({ resourceType: item.resourceType, resourceId: item.id }) }); refresh(); })}><FiX aria-hidden="true" /></button>}</div></li>)}{!items.length && <li>Adicione links, campanhas, Smart Pages, UTMs ou QR Codes quando eles pertencerem a esta iniciativa.</li>}</ul></section>
    <section className="workspace-panel project-collections-panel"><div className="workspace-panel-heading"><div><span className="eyebrow">Agrupamentos</span><h2>Collections deste projeto</h2></div><Link className="workspace-inline-link" href="/untrack/collections">Gerenciar</Link></div>{collections.length ? <ul className="intelligence-resources">{collections.map((collection) => <li key={collection.id}><strong>{collection.name}</strong><small>{collection.kind} · {collection._count.resources} recurso(s)</small></li>)}</ul> : <p>Crie uma collection para destacar, por exemplo, ofertas, social ou retargeting.</p>}</section>
  </div>;
}
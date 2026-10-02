"use client";
import { useEffect, useState } from "react";
import { apiRequest, useCollection, useAction, ActionStatus, CollectionState, Pager } from "./shared";
interface Item { id: string; name?: string; status?: string; clientId?: string; role?: string; userId?: string; user?: { name: string; email: string }; hostname?: string; token?: string; lastError?: string; action?: string; actorId?: string; entityId?: string; createdAt?: string; details?: unknown }
const labels: Record<string, string> = { clients: "Clientes", campaigns: "Campanhas", members: "Equipe", folders: "Pastas", domains: "Domínios próprios", audit: "Auditoria" };
export function ResourcePanel({ module }: { module: string }) {
  const [search, setSearch] = useState(""), [name, setName] = useState(""), [role, setRole] = useState("viewer"), [clientId, setClientId] = useState(""), [status, setStatus] = useState("draft"), [editing, setEditing] = useState<string | null>(null);
  const list = useCollection<Item>(module, search), clients = useCollection<Item>("clients"), action = useAction();
  async function save() {
    const data = module === "members" ? editing ? { role } : { email: name, role } : module === "campaigns" ? { name, clientId: clientId || null, status } : { name };
    await apiRequest(`/api/workspace/${module}`, { method: editing ? "PATCH" : "POST", body: JSON.stringify(module === "domains" ? { hostname: name } : { ...(editing ? { id: editing } : {}), data }) });
    setName(""); setEditing(null); await list.refresh(); action.setNotice("Alteração salva no workspace.");
  }
  return <div className="tool-stack"><h2>{labels[module] ?? module}</h2>
    {module === "domains" && <div className="prose-card"><p>Adicione um subdomínio, publique o TXT de posse e configure o CNAME para o destino definido em SHORT_LINKS_CNAME na hospedagem. Cadastre o hostname no provedor para provisionar HTTPS.</p><p>O domínio só fica ativo após DNS, certificado TLS e rota LinkOr serem confirmados. Nenhum certificado é simulado.</p></div>}
    {module !== "audit" && <form className="tool-card account-form" onSubmit={(event) => { event.preventDefault(); void action.run(save); }}>
      {(!editing || module !== "members") && <label>{module === "members" ? "E-mail de uma conta existente" : module === "domains" ? "Hostname (ex.: go.suaempresa.com)" : "Nome"}<input required maxLength={module === "domains" ? 253 : 120} type={module === "members" ? "email" : "text"} value={name} onChange={(event) => setName(event.target.value)} /></label>}
      {module === "members" && <label>Papel<select value={role} onChange={(event) => setRole(event.target.value)}>{["owner", "admin", "editor", "viewer"].map((value) => <option key={value}>{value}</option>)}</select></label>}
      {module === "campaigns" && <><label>Cliente<select value={clientId} onChange={(event) => setClientId(event.target.value)}><option value="">Sem cliente</option>{clients.items.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label><label>Status<select value={status} onChange={(event) => setStatus(event.target.value)}>{["draft", "active", "archived"].map((value) => <option key={value}>{value}</option>)}</select></label></>}
      <button className="button" disabled={action.busy}>{editing ? "Salvar alterações" : "Adicionar"}</button>{editing && <button type="button" className="button button-secondary" onClick={() => { setEditing(null); setName(""); }}>Cancelar edição</button>}
    </form>}
    <ActionStatus {...action} />
    <label>Buscar {module === "audit" ? "por identificador do ativo" : "por nome"}<input value={search} onChange={(event) => { setSearch(event.target.value); list.setPage(1); }} /></label>
    <CollectionState loading={list.loading} error={list.error} empty={!list.items.length} />
    {list.items.map((item) => <article className="tool-card" key={item.id ?? item.userId}><h3>{item.name ?? item.user?.name ?? item.hostname ?? item.action}</h3>
      {item.user && <p>{item.user.email} · {item.role}</p>}{item.status && <p>Status: {item.status}</p>}
      {module === "domains" && <><p>TXT em <code>_untrack.{item.hostname}</code></p><code>untrack-verification={item.token}</code><p>{item.lastError}</p><button className="button" disabled={action.busy} onClick={() => void action.run(async () => { await apiRequest("/api/workspace/domains", { method: "PATCH", body: JSON.stringify({ id: item.id }) }); await list.refresh(); })}>Verificar DNS e HTTPS</button></>}
      {module === "audit" && <><p>{item.createdAt} · Autor: {item.actorId} · Ativo: {item.entityId}</p><details><summary>Alterações registradas</summary><pre className="workspace-json">{JSON.stringify(item.details, null, 2)}</pre></details></>}
      {!["domains", "audit"].includes(module) && <div className="action-row"><button className="button button-secondary" onClick={() => { setEditing(item.id ?? item.userId!); setName(item.name ?? item.user?.email ?? ""); setRole(item.role ?? "viewer"); setClientId(item.clientId ?? ""); setStatus(item.status ?? "draft"); }}>Editar</button><button className="button button-quiet" disabled={action.busy} onClick={() => { if (window.confirm("Excluir este registro do workspace?")) void action.run(async () => { await apiRequest(`/api/workspace/${module}`, { method: "DELETE", body: JSON.stringify({ id: item.id ?? item.userId }) }); await list.refresh(); }); }}>Excluir</button></div>}
    </article>)}<Pager {...list} />
  </div>;
}
interface Usage { plan: string; limits: Record<string, number>; usage: { resource: string; count: number }[]; downgradePolicy: string }
export function UsagePanel() {
  const [data, setData] = useState<Usage | null>(null), [error, setError] = useState("");
  useEffect(() => { apiRequest<Usage>("/api/workspace/usage").then(setData).catch((error: Error) => setError(error.message)); }, []);
  if (error) return <p role="alert">{error}</p>;
  if (!data) return <p role="status">Carregando cotas...</p>;
  return <div className="tool-card"><h2>Plano {data.plan}</h2><p>{data.downgradePolicy}</p><ul>{Object.entries(data.limits).map(([resource, limit]) => <li key={resource}>{resource}: {data.usage.find((usage) => usage.resource === resource)?.count ?? 0} / {limit}</li>)}</ul><p>Alterações de plano são administrativas. Esta etapa não cobra nem simula assinaturas.</p></div>;
}
export function ApiPanel() {
  return <article className="prose-card"><h2>API LinkOr</h2><p>A API usa a sessão autenticada e o workspace selecionado no servidor. Permissões, governança e cotas são idênticas às da interface.</p><ul><li>GET /api/workspaces — workspaces disponíveis.</li><li>POST /api/workspaces — criar ou selecionar workspace.</li><li>GET /api/workspace/utm — histórico pesquisável.</li><li>POST /api/workspace/utm-preview — validação e conflitos.</li><li>POST /api/workspace/utm — salvar resultado validado.</li><li>POST /api/workspace/utm-bulk — lote de até 100 itens.</li><li>POST /api/workspace/links — criar short link.</li><li>POST /api/workspace/csv — preview e importação.</li><li>POST /api/workspace/qrs — QR estático ou dinâmico.</li></ul><p>Envie JSON. Erros de governança bloqueiam o salvamento; avisos não bloqueiam. O contrato completo está documentado em docs/untrack.md no projeto.</p></article>;
}

"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, useAction, ActionStatus } from "./shared";
interface Membership { role: string; workspace: { id: string; name: string; plan: string } }
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]), [active, setActive] = useState<string | null>(null), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [name, setName] = useState("");
  const action = useAction(), router = useRouter();
  useEffect(() => { apiRequest<{ items: Membership[]; activeId: string | null }>("/api/workspaces").then((data) => { setMemberships(data.items); setActive(data.activeId); }).catch((error: Error) => setError(error.message)).finally(() => setLoading(false)); }, []);
  async function select(id: string) { await apiRequest("/api/workspaces", { method: "POST", body: JSON.stringify({ action: "select", workspaceId: id }) }); window.location.reload(); }
  return <section className="shell page-section"><div className="page-heading"><span className="eyebrow">Untrack</span><h1>Workspace</h1><p>Campanhas, links e distribuições da sua equipe.</p></div>
    {loading ? <p role="status">Carregando workspaces...</p> : error ? <p role="alert">{error}</p> : <div className="tool-card account-form"><label>Workspace ativo<select value={active ?? ""} disabled={action.busy} onChange={(event) => void action.run(() => select(event.target.value))}><option value="" disabled>Selecione um workspace</option>{memberships.map((item) => <option key={item.workspace.id} value={item.workspace.id}>{item.workspace.name} · {item.role} · {item.workspace.plan}</option>)}</select></label><details><summary>Criar workspace</summary><form className="account-form" onSubmit={(event) => { event.preventDefault(); void action.run(async () => { await apiRequest("/api/workspaces", { method: "POST", body: JSON.stringify({ action: "create", name }) }); router.refresh(); window.location.reload(); }); }}><label>Nome<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button" disabled={action.busy}>Criar workspace</button></form></details><ActionStatus {...action} /></div>}
    <nav className="workspace-nav" aria-label="Módulos Untrack">{[["members", "Equipe"], ["clients", "Clientes"], ["campaigns", "Campanhas"], ["utm", "UTM"], ["links", "Short links"], ["qrs", "QR Codes"], ["domains", "Domínios"], ["usage", "Plano e cotas"], ["audit", "Auditoria"], ["api", "API"]].map(([path, label]) => <Link key={path} href={`/untrack/${path}`}>{label}</Link>)}<Link href="/conta">Analytics</Link><Link href="/link-health">Checks de links</Link></nav>
    {active && !loading ? children : !loading && !error ? <p>Selecione um workspace para acessar os recursos privados.</p> : null}
  </section>;
}

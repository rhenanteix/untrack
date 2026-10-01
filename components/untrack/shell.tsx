"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { apiRequest, useAction, ActionStatus } from "./shared";
interface Membership {
  role: string;
  workspace: { id: string; name: string; plan: string };
}
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]),
    [active, setActive] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [name, setName] = useState("");
  const action = useAction(),
    router = useRouter(),
    pathname = usePathname();
  useEffect(() => {
    apiRequest<{ items: Membership[]; activeId: string | null }>(
      "/api/workspaces",
    )
      .then((data) => {
        setMemberships(data.items);
        setActive(data.activeId);
      })
      .catch((error: Error) => setError(error.message))
      .finally(() => setLoading(false));
  }, []);
  async function select(id: string) {
    await apiRequest("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "select", workspaceId: id }),
    });
    window.location.reload();
  }
  const groups = [
    { label: "Visão geral", items: [["/conta", "Visão geral"], ["/untrack/smart-pages", "Smart Pages"], ["/untrack/campaigns", "Campanhas"]] },
    { label: "Criar e distribuir", items: [["/encurtar", "Short links"], ["/untrack/utm", "UTM"], ["/untrack/qrs", "QR Codes"], ["/link-health", "Link Health"]] },
    { label: "Gerenciar", items: [["/untrack/clients", "Clientes"], ["/untrack/domains", "Domínios"], ["/untrack/members", "Equipe"], ["/untrack/usage", "Plano e cotas"], ["/untrack/audit", "Auditoria"], ["/untrack/api", "API"]] },
  ];
  return <div className="product-shell">
    <aside className="product-sidebar" aria-label="Navegação do produto">
      <Link className="product-brand" href="/conta"><span aria-hidden="true">↗</span><strong>Untrack</strong></Link>
      {loading ? <p role="status" className="product-loading">Carregando...</p> : error ? <p role="alert" className="form-error">{error}</p> : <div className="workspace-switcher"><label>Workspace<select value={active ?? ""} disabled={action.busy} onChange={(event) => void action.run(() => select(event.target.value))}><option value="" disabled>Selecione um workspace</option>{memberships.map((item) => <option key={item.workspace.id} value={item.workspace.id}>{item.workspace.name} · {item.role}</option>)}</select></label><details><summary>Novo workspace</summary><form onSubmit={(event) => { event.preventDefault(); void action.run(async () => { await apiRequest("/api/workspaces", { method: "POST", body: JSON.stringify({ action: "create", name }) }); router.refresh(); window.location.reload(); }); }}><label>Nome<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} /></label><button className="button button-small" disabled={action.busy}>Criar</button></form></details></div>}
      <nav className="product-nav">{groups.map((group) => <div key={group.label}><span>{group.label}</span>{group.items.map(([href, label]) => <Link key={href} href={href} aria-current={pathname === href || (href !== "/conta" && pathname.startsWith(`${href}/`)) ? "page" : undefined}>{label}</Link>)}</div>)}</nav>
      <ActionStatus {...action} />
    </aside>
    <main className="product-main">{active && !loading ? children : !loading && !error ? <div className="product-empty"><h1>Escolha um workspace</h1><p>Crie ou selecione um workspace para acessar seus ativos.</p></div> : null}</main>
  </div>;
}

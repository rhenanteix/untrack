"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiRequest, useAction, ActionStatus } from "./shared";
interface Membership {
  role: string;
  workspace: { id: string; name: string; plan: string };
}
const groups = [
  {
    label: "Espaço pessoal",
    items: [
      { href: "/conta", label: "Meu painel" },
      { href: "/untrack/smart-pages", label: "Minha página" },
      { label: "Currículos", status: "Em breve" },
      { label: "Portfólio", status: "Em breve" },
    ],
  },
  {
    label: "Trabalho profissional",
    items: [
      { href: "/untrack/short-links", label: "Links rastreáveis" },
      { href: "/untrack/utm", label: "Campanhas UTM" },
      { href: "/untrack/qr", label: "QR Codes" },
      { href: "/untrack/link-health", label: "Saúde de links" },
      { href: "/untrack/campaigns", label: "Campanhas" },
    ],
  },
  {
    label: "Administração",
    items: [
      { href: "/untrack/clients", label: "Clientes" },
      { href: "/untrack/domains", label: "Domínios" },
      { href: "/untrack/members", label: "Equipe" },
      { href: "/untrack/usage", label: "Plano e cotas" },
      { href: "/untrack/audit", label: "Auditoria" },
      { href: "/untrack/api", label: "API" },
    ],
  },
];
export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]),
    [active, setActive] = useState<string | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [name, setName] = useState(""),
    [openedAt, setOpenedAt] = useState<string | null>(null);
  const action = useAction(),
    pathname = usePathname();
  const open = openedAt === pathname;
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<{
        items: Membership[];
        activeId: string | null;
      }>("/api/workspaces");
      setMemberships(data.items);
      setActive(data.activeId);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os workspaces.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: Membership[]; activeId: string | null }>(
      "/api/workspaces",
      { signal: controller.signal },
    )
      .then((data) => {
        if (!controller.signal.aborted) {
          setMemberships(data.items);
          setActive(data.activeId);
        }
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function select(id: string) {
    if (id === active) return;
    await apiRequest("/api/workspaces", {
      method: "POST",
      body: JSON.stringify({ action: "select", workspaceId: id }),
    });
    window.location.reload();
  }
  const current = memberships.find((item) => item.workspace.id === active);
  return (
    <div className="product-shell">
      <div className="product-mobile-bar">
        <Link href="/conta" className="product-brand">
          <span aria-hidden="true">↗</span>
          <strong>Untrack</strong>
        </Link>
        <button
          className="button button-secondary"
          type="button"
          aria-controls="workspace-navigation"
          aria-expanded={open}
          onClick={() => setOpenedAt(open ? null : pathname)}
        >
          {open ? "Fechar navegação" : "Menu do workspace"}
        </button>
      </div>
      <aside
        id="workspace-navigation"
        className={`product-sidebar${open ? " is-open" : ""}`}
        aria-label="Navegação do produto"
      >
        <Link className="product-brand" href="/conta">
          <span aria-hidden="true">↗</span>
          <strong>Untrack</strong>
        </Link>
        {loading ? (
          <p role="status" className="product-loading">
            Carregando workspaces...
          </p>
        ) : error ? (
          <div role="alert">
            <p className="form-error">{error}</p>
            <button
              className="button button-secondary"
              onClick={() => void load()}
            >
              Recarregar workspaces
            </button>
          </div>
        ) : (
          <div className="workspace-switcher">
            <label>
              Workspace
              <select
                value={active ?? ""}
                disabled={action.busy}
                onChange={(event) =>
                  void action.run(() => select(event.target.value))
                }
              >
                <option value="" disabled>
                  Selecione um workspace
                </option>
                {memberships.map((item) => (
                  <option key={item.workspace.id} value={item.workspace.id}>
                    {item.workspace.name}
                  </option>
                ))}
              </select>
            </label>
            {current && (
              <p className="workspace-role">
                {current.role} · Plano {current.workspace.plan}
              </p>
            )}
            <details>
              <summary>Criar outro workspace</summary>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void action.run(async () => {
                    await apiRequest("/api/workspaces", {
                      method: "POST",
                      body: JSON.stringify({ action: "create", name }),
                    });
                    window.location.reload();
                  });
                }}
              >
                <label>
                  Nome do workspace
                  <input
                    required
                    maxLength={120}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
                <button className="button button-small" disabled={action.busy}>
                  Criar workspace
                </button>
              </form>
            </details>
          </div>
        )}
        <nav className="product-nav" aria-label="Módulos do workspace">
          {groups.map((group) => (
            <div key={group.label}>
              <span>{group.label}</span>
              {group.items.map((item) =>
                item.href ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpenedAt(null)}
                    aria-current={
                      pathname === item.href ||
                      (item.href !== "/conta" &&
                        pathname.startsWith(`${item.href}/`))
                        ? "page"
                        : undefined
                    }
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span className="product-nav-placeholder" key={item.label} aria-disabled="true">
                    {item.label}
                    <small>{item.status}</small>
                  </span>
                ),
              )}
            </div>
          ))}
        </nav>
        <ActionStatus {...action} />
      </aside>
      <div className="product-main">
        {loading ? (
          <div className="product-empty" role="status">
            <h1>Preparando seu workspace</h1>
            <p>Carregando os dados e as permissões da equipe...</p>
          </div>
        ) : error ? (
          <div className="product-empty">
            <h1>Seu workspace não carregou</h1>
            <p>Use “Recarregar workspaces” no menu para tentar novamente.</p>
          </div>
        ) : active ? (
          children
        ) : (
          <div className="product-empty">
            <h1>Escolha um workspace</h1>
            <p>
              Seu acesso pode ter mudado. Selecione um workspace disponível no
              menu para continuar.
            </p>
            <button
              className="button button-secondary"
              onClick={() => setOpenedAt(pathname)}
            >
              Abrir seletor de workspace
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

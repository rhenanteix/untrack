"use client";
import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { apiRequest, useAction, ActionStatus } from "./shared";
interface Membership {
  role: string;
  workspace: { id: string; name: string; plan: string };
}
const groups = [
  {
    label: "Workspace",
    collapsible: false,
    items: [
      { href: "/conta", label: "Visão geral" },
      { href: "/untrack/clients", label: "Clientes" },
      { href: "/untrack/campaigns", label: "Campanhas" },
      { href: "/untrack/short-links", label: "Links" },
      { href: "/untrack/smart-pages", label: "Smart Pages" },
      { href: "/untrack/utm", label: "Construtor UTM" },
      { href: "/untrack/qr", label: "QR Codes" },
      { href: "/untrack/link-health", label: "Qualidade" },
    ],
  },
  {
    label: "Administração",
    collapsible: true,
    items: [
      { href: "/untrack/members", label: "Equipe" },
      { href: "/untrack/domains", label: "Domínios" },
      { href: "/untrack/usage", label: "Plano e cotas" },
      { href: "/untrack/audit", label: "Auditoria" },
      { href: "/untrack/api", label: "API" },
    ],
  },
];
const roleNames: Record<string, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  editor: "Editor",
  viewer: "Leitor",
};
const planNames: Record<string, string> = {
  free: "Gratuito",
  pro: "Profissional",
  business: "Empresarial",
};
const WorkspaceContext = createContext<Membership | undefined>(undefined);
export function useWorkspace() {
  return useContext(WorkspaceContext);
}
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
  useEffect(() => {
    if (open)
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#workspace-navigation a")?.focus(),
      );
  }, [open]);
  const current = memberships.find((item) => item.workspace.id === active);
  function renderItems(items: (typeof groups)[number]["items"]) {
    return items
      .filter(
        (item) =>
          !groups[1].items.some((admin) => admin.href === item.href) ||
          item.href === "/untrack/usage" ||
          ["owner", "admin"].includes(current?.role ?? ""),
      )
      .map((item) => {
        const itemPath = item.href.split("#", 1)[0];
        return (
          <Link
            className="workspace-nav-link"
            key={item.href}
            href={item.href}
            onClick={() => setOpenedAt(null)}
            aria-current={
              pathname === itemPath ||
              (itemPath !== "/conta" && pathname.startsWith(`${itemPath}/`))
                ? "page"
                : undefined
            }
          >
            {item.label}
          </Link>
        );
      });
  }
  return (
    <WorkspaceContext.Provider value={current}>
      <div className="product-shell">
        <div className="product-mobile-bar">
          <Link href="/conta" className="product-brand">
            <span aria-hidden="true">↗</span>
            <strong>Untrack</strong>
          </Link>
          <button
            id="workspace-menu-toggle"
            className="button button-secondary"
            type="button"
            aria-controls="workspace-navigation"
            aria-expanded={open}
            onClick={() => setOpenedAt(open ? null : pathname)}
          >
            {open ? "Fechar navegação" : "Menu do workspace"}
          </button>
        </div>
        {open && (
          <button
            className="workspace-drawer-backdrop"
            aria-label="Fechar navegação"
            onClick={() => {
              setOpenedAt(null);
              document.getElementById("workspace-menu-toggle")?.focus();
            }}
          />
        )}
        <aside
          role={open ? "dialog" : undefined}
          aria-modal={open || undefined}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpenedAt(null);
              document.getElementById("workspace-menu-toggle")?.focus();
            }
            if (open && event.key === "Tab") {
              const focusables = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "a[href],button:not([disabled]),select,summary,input",
                ),
              ).filter((element) => element.getClientRects().length > 0);
              const first = focusables[0],
                last = focusables.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
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
                  {roleNames[current.role]} ·{" "}
                  {planNames[current.workspace.plan]}
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
                  <button
                    className="button button-small"
                    disabled={action.busy}
                  >
                    Criar workspace
                  </button>
                </form>
              </details>
            </div>
          )}
          <nav className="product-nav" aria-label="Módulos do workspace">
            {groups.map((group) =>
              group.collapsible ? (
                <details
                  className="workspace-nav-group workspace-nav-advanced"
                  key={group.label}
                >
                  <summary>{group.label}</summary>
                  <div>{renderItems(group.items)}</div>
                </details>
              ) : (
                <div className="workspace-nav-group" key={group.label}>
                  <span className="workspace-nav-label">{group.label}</span>
                  {renderItems(group.items)}
                </div>
              ),
            )}
          </nav>
          <details className="product-quick-tools">
            <summary>Ferramentas rápidas</summary>
            <Link href="/limpar-link">Limpar link</Link>
            <Link href="/gerar-utm">UTM público</Link>
            <Link href="/gerar-qrcode">QR público</Link>
          </details>
          <details className="product-account-menu">
            <summary>Minha conta</summary>
            <Link href="/conta/perfil">Perfil e histórico</Link>
            <SignOutButton />
          </details>
          <ActionStatus {...action} />
        </aside>
        <div className="product-main">
          <div className="workspace-topbar">
            <nav aria-label="Caminho de navegação">
              <Link href="/conta">
                {current?.workspace.name ?? "Workspace"}
              </Link>
              <span aria-hidden="true"> / </span>
              <span>
                {groups
                  .flatMap((group) => group.items)
                  .find(
                    (item) =>
                      pathname === item.href ||
                      (item.href !== "/conta" &&
                        pathname.startsWith(`${item.href}/`)),
                  )?.label ??
                  (pathname.startsWith("/conta/perfil")
                    ? "Perfil e histórico"
                    : "Detalhes do link")}
              </span>
            </nav>
            <span className="workspace-role">
              {current ? roleNames[current.role] : ""}
            </span>
          </div>
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
    </WorkspaceContext.Provider>
  );
}

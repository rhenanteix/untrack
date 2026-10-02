"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  FiActivity,
  FiBarChart2,
  FiChevronDown,
  FiChevronsLeft,
  FiChevronsRight,
  FiGrid,
  FiHome,
  FiLink,
  FiMenu,
  FiMessageCircle,
  FiMoreHorizontal,
  FiPlus,
  FiSettings,
  FiTarget,
  FiTool,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { SignOutButton } from "@/components/sign-out-button";
import { authClient } from "@/lib/client/auth";
import { analytics } from "@/lib/client/analytics";
import { ActionStatus, apiRequest, useAction } from "./shared";

interface Membership {
  role: string;
  workspace: { id: string; name: string; plan: string };
}

type NavigationItem = { href: string; label: string; icon: IconType };
type NavigationGroup = { label: string; items: NavigationItem[] };

const overviewItem: NavigationItem = {
  href: "/conta",
  label: "Início",
  icon: FiHome,
};

const groups: NavigationGroup[] = [
  {
    label: "Gestão",
    items: [
      { href: "/untrack/short-links", label: "Links", icon: FiLink },
      { href: "/untrack/smart-pages", label: "Smart Pages", icon: FiGrid },
      { href: "/untrack/campaigns", label: "Campanhas", icon: FiTarget },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      { href: "/untrack/utm", label: "UTM Builder", icon: FiTool },
      { href: "/untrack/qr", label: "QR Codes", icon: FiGrid },
      { href: "/untrack/whatsapp", label: "WhatsApp", icon: FiMessageCircle },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { href: "/conta#desempenho", label: "Analytics", icon: FiBarChart2 },
      { href: "/untrack/link-health", label: "Monitoring", icon: FiActivity },
      { href: "/conta#insights", label: "Insights", icon: FiActivity },
    ],
  },
];

const planNames: Record<string, string> = {
  free: "Gratuito",
  pro: "Professional",
  business: "Business",
};

const WorkspaceContext = createContext<Membership | undefined>(undefined);

export function useWorkspace() {
  return useContext(WorkspaceContext);
}

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "UT";
}

function subscribeToSidebarPreference(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener("untrack-sidebar-preference", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener("untrack-sidebar-preference", listener);
  };
}

function sidebarIsCollapsed() {
  return window.localStorage.getItem("untrack-sidebar-collapsed") === "true";
}

function WorkspaceSwitcher({
  active,
  current,
  memberships,
  busy,
  onSelect,
  onCreate,
}: {
  active: string | null;
  current: Membership | undefined;
  memberships: Membership[];
  busy: boolean;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <details className="workspace-switcher">
      <summary title="Trocar workspace">
        <span className="workspace-switcher-mark" aria-hidden="true">
          <FiGrid />
        </span>
        <span className="workspace-switcher-copy">
          <strong>{current?.workspace.name ?? "Seu workspace"}</strong>
          <small>{current ? planNames[current.workspace.plan] : ""}</small>
        </span>
        <FiChevronDown className="workspace-switcher-chevron" aria-hidden="true" />
      </summary>
      <div className="workspace-switcher-popover">
        <span className="workspace-switcher-title">Workspaces</span>
        <div className="workspace-switcher-options">
          {memberships.map((item) => (
            <button
              key={item.workspace.id}
              type="button"
              disabled={busy}
              onClick={() => onSelect(item.workspace.id)}
              aria-current={item.workspace.id === active ? "page" : undefined}
            >
              <span>
                <strong>{item.workspace.name}</strong>
                <small>{planNames[item.workspace.plan]}</small>
              </span>
              {item.workspace.id === active ? (
                <span className="workspace-switcher-selected" aria-label="Selecionado" />
              ) : null}
            </button>
          ))}
        </div>
        <form
          className="workspace-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate(name);
          }}
        >
          <label>
            <span>Novo workspace</span>
            <input
              required
              maxLength={120}
              value={name}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button type="submit" disabled={busy}>
            <FiPlus aria-hidden="true" />
            Criar workspace
          </button>
        </form>
        <Link href="/conta/perfil">Gerenciar workspaces</Link>
      </div>
    </details>
  );
}

function UserMenu({ name, plan }: { name: string; plan: string }) {
  return (
    <details className="workspace-user-menu">
      <summary title="Abrir menu da conta">
        <span className="workspace-user-avatar" aria-hidden="true">
          {initials(name)}
        </span>
        <span className="workspace-user-copy">
          <strong>{name}</strong>
          <small>{plan}</small>
        </span>
        <FiMoreHorizontal aria-hidden="true" />
      </summary>
      <div className="workspace-user-popover">
        <Link href="/conta/perfil">Perfil</Link>
        <Link href="/conta/perfil">Conta</Link>
        <Link href="/untrack/usage" onClick={() => analytics.track("upgrade_clicked")}>
          Plano e cobrança
        </Link>
        <Link href="/conta/perfil#preferencias">Preferências</Link>
        <Link href="/ajuda">Ajuda</Link>
        <hr />
        <SignOutButton />
      </div>
    </details>
  );
}

export function WorkspaceShell({ children }: { children: ReactNode }) {
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const action = useAction();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const collapsed = useSyncExternalStore(
    subscribeToSidebarPreference,
    sidebarIsCollapsed,
    () => false,
  );
  const open = openedAt === pathname;
  const current = memberships.find((item) => item.workspace.id === active);
  const accountName = session?.user.name || "Sua conta";

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
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
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
      .catch((loadError: Error) => {
        if (!controller.signal.aborted) setError(loadError.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() =>
        document.querySelector<HTMLElement>("#workspace-navigation a")?.focus(),
      );
    }
  }, [open]);

  function select(id: string) {
    if (id === active) return;
    void action.run(async () => {
      await apiRequest("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ action: "select", workspaceId: id }),
      });
      window.location.reload();
    });
  }

  function createWorkspace(name: string) {
    void action.run(async () => {
      await apiRequest("/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ action: "create", name }),
      });
      window.location.reload();
    });
  }

  function toggleCollapsed() {
    window.localStorage.setItem("untrack-sidebar-collapsed", String(!collapsed));
    window.dispatchEvent(new Event("untrack-sidebar-preference"));
  }

  function renderItems(items: NavigationItem[]) {
    return items.map((item) => {
      const itemPath = item.href.split("#", 1)[0];
      const isAnchor = item.href.includes("#");
      const isCurrent =
        !isAnchor &&
        (pathname === itemPath ||
          (itemPath !== "/conta" && pathname.startsWith(`${itemPath}/`)));
      const Icon = item.icon;
      return (
        <Link
          className="workspace-nav-link"
          key={item.href}
          href={item.href}
          title={collapsed ? item.label : undefined}
          onClick={() => {
            analytics.track("module_opened");
            setOpenedAt(null);
          }}
          aria-current={isCurrent ? "page" : undefined}
        >
          <Icon aria-hidden="true" />
          <span>{item.label}</span>
        </Link>
      );
    });
  }

  const canWrite = current ? current.role !== "viewer" : false;
  const plan = current ? planNames[current.workspace.plan] : "";

  return (
    <WorkspaceContext.Provider value={current}>
      <div className={`product-shell${collapsed ? " is-collapsed" : ""}`}>
        <div className="product-mobile-bar">
          <button
            id="workspace-menu-toggle"
            className="product-mobile-menu"
            type="button"
            aria-label="Menu do workspace"
            aria-controls="workspace-navigation"
            aria-expanded={open}
            onClick={() => setOpenedAt(open ? null : pathname)}
          >
            <FiMenu aria-hidden="true" />
          </button>
          <Link href="/conta" className="product-brand">
            <FiLink aria-hidden="true" />
            <strong>Untrack</strong>
          </Link>
          {canWrite ? (
            <Link
              className="product-mobile-create"
              href="/untrack/short-links?create=1"
              aria-label="Criar link"
              title="Criar link"
            >
              <FiPlus aria-hidden="true" />
            </Link>
          ) : (
            <span className="product-mobile-spacer" aria-hidden="true" />
          )}
        </div>
        {open ? (
          <button
            className="workspace-drawer-backdrop"
            aria-label="Fechar navegação"
            onClick={() => {
              setOpenedAt(null);
              document.getElementById("workspace-menu-toggle")?.focus();
            }}
          />
        ) : null}
        <aside
          role={open ? "dialog" : undefined}
          aria-modal={open || undefined}
          id="workspace-navigation"
          className={`product-sidebar${open ? " is-open" : ""}`}
          aria-label="Navegação do produto"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpenedAt(null);
              document.getElementById("workspace-menu-toggle")?.focus();
            }
            if (open && event.key === "Tab") {
              const focusables = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  "a[href],button:not([disabled]),summary,input",
                ),
              ).filter((element) => element.getClientRects().length > 0);
              const first = focusables[0];
              const last = focusables.at(-1);
              if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
              } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
              }
            }
          }}
        >
          <div className="product-sidebar-brand-row">
            <Link className="product-brand" href="/conta">
              <FiLink aria-hidden="true" />
              <strong>Untrack</strong>
            </Link>
            <button
              className="workspace-sidebar-collapse"
              type="button"
              aria-label={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              title={collapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
              onClick={toggleCollapsed}
            >
              {collapsed ? <FiChevronsRight aria-hidden="true" /> : <FiChevronsLeft aria-hidden="true" />}
            </button>
          </div>
          {loading ? (
            <p role="status" className="product-loading">
              Carregando workspaces...
            </p>
          ) : error ? (
            <div className="workspace-sidebar-error" role="alert">
              <p>{error}</p>
              <button type="button" onClick={() => void load()}>
                Recarregar workspaces
              </button>
            </div>
          ) : (
            <WorkspaceSwitcher
              active={active}
              current={current}
              memberships={memberships}
              busy={action.busy}
              onSelect={select}
              onCreate={createWorkspace}
            />
          )}
          <nav className="product-nav" aria-label="Módulos do workspace">
            <div className="workspace-nav-group workspace-nav-overview">
              {renderItems([overviewItem])}
            </div>
            {groups.map((group) => (
              <div className="workspace-nav-group" key={group.label}>
                <span className="workspace-nav-label">{group.label}</span>
                {renderItems(group.items)}
              </div>
            ))}
          </nav>
          <Link
            className="workspace-settings-link workspace-nav-link"
            href="/conta/perfil"
            title={collapsed ? "Configurações" : undefined}
          >
            <FiSettings aria-hidden="true" />
            <span>Configurações</span>
          </Link>
          <UserMenu name={accountName} plan={plan} />
          <ActionStatus {...action} />
        </aside>
        <main className="product-main">
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
              <p>Seu acesso pode ter mudado. Selecione um workspace disponível no menu para continuar.</p>
              <button type="button" onClick={() => setOpenedAt(pathname)}>
                Abrir seletor de workspace
              </button>
            </div>
          )}
        </main>
      </div>
    </WorkspaceContext.Provider>
  );
}

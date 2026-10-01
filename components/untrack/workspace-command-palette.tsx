"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FiPlus, FiSearch, FiX } from "react-icons/fi";
import { apiRequest } from "./shared";

type SearchItem = {
  id: string;
  resourceType: string;
  name: string;
  href: string;
};

const quickActions = [
  { label: "Novo projeto", href: "/untrack/projects?create=1" },
  { label: "Novo link", href: "/untrack/short-links?create=1" },
  { label: "Nova Smart Page", href: "/untrack/smart-pages?create=1" },
  { label: "Nova campanha", href: "/untrack/campaigns?create=1" },
  { label: "Novo QR Code", href: "/untrack/qr" },
  { label: "Criar UTM", href: "/untrack/utm" },
];

const navigation = [
  { label: "Visão geral", href: "/conta" },
  { label: "Projetos", href: "/untrack/projects" },
  { label: "Favoritos", href: "/untrack/favorites" },
  { label: "Collections", href: "/untrack/collections" },
];

export function WorkspaceCommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!open || !query.trim()) return;
    const controller = new AbortController();
    apiRequest<{ items: SearchItem[] }>(
      `/api/search?query=${encodeURIComponent(query.trim())}`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) {
          setItems(result.items);
          setError("");
        }
      })
      .catch((searchError: Error) => {
        if (!controller.signal.aborted) {
          setItems([]);
          setError(searchError.message);
        }
      });
    return () => controller.abort();
  }, [open, query]);

  function navigate(href: string) {
    setOpen(false);
    setQuery("");
    setItems([]);
    router.push(href);
  }

  return (
    <>
      <button
        className="workspace-search-trigger"
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Pesquisar no workspace"
      >
        <FiSearch aria-hidden="true" />
        <span>Pesquisar</span>
        <kbd>Ctrl K</kbd>
      </button>
      {open && (
        <div className="command-palette-backdrop" role="presentation" onMouseDown={() => setOpen(false)}>
          <section
            className="command-palette"
            role="dialog"
            aria-modal="true"
            aria-label="Pesquisar e executar ações"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="command-palette-input">
              <FiSearch aria-hidden="true" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Pesquisar tudo..."
                aria-label="Pesquisar tudo"
              />
              <button type="button" aria-label="Fechar pesquisa" title="Fechar" onClick={() => setOpen(false)}>
                <FiX aria-hidden="true" />
              </button>
            </div>
            {query.trim() ? (
              <div className="command-palette-results">
                <span>Resultados</span>
                {error ? <p role="alert">{error}</p> : null}
                {!error && !items.length ? <p>Nenhum resultado encontrado.</p> : null}
                {items.map((item) => (
                  <button key={`${item.resourceType}:${item.id}`} type="button" onClick={() => navigate(item.href)}>
                    <strong>{item.name}</strong>
                    <small>{item.resourceType}</small>
                  </button>
                ))}
              </div>
            ) : (
              <div className="command-palette-results">
                <span>Criar</span>
                {quickActions.map((item) => (
                  <button key={item.href} type="button" onClick={() => navigate(item.href)}>
                    <FiPlus aria-hidden="true" />
                    <strong>{item.label}</strong>
                  </button>
                ))}
                <span>Navegar</span>
                {navigation.map((item) => (
                  <button key={item.href} type="button" onClick={() => navigate(item.href)}>
                    <strong>{item.label}</strong>
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
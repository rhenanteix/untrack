"use client";
import { useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { apiRequest } from "@/lib/client/api";
import { readHistory } from "@/lib/client/history";
import type {
  ShortLinkView,
  HistoryView,
  PageResult,
} from "@/modules/short-links/types";

export function AccountDashboard({
  initialLinks,
  initialHistory,
}: {
  initialLinks: PageResult<ShortLinkView>;
  initialHistory: PageResult<HistoryView>;
}) {
  const [links, setLinks] = useState(initialLinks);
  const [history, setHistory] = useState(initialHistory);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function action(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadLinks(page: number) {
    setLinks(
      await apiRequest<PageResult<ShortLinkView>>(
        `/api/short-links?page=${page}`,
      ),
    );
  }
  async function loadHistory(page: number) {
    setHistory(
      await apiRequest<PageResult<HistoryView>>(`/api/history?page=${page}`),
    );
  }

  async function toggle(link: ShortLinkView) {
    await action(async () => {
      await apiRequest(`/api/short-links/${link.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isActive: !link.isActive }),
      });
      await loadLinks(links.page);
      setNotice(
        link.isActive
          ? "Link desativado. O endereço público não redireciona mais."
          : "Link reativado.",
      );
    });
  }

  async function removeLink(id: string) {
    await action(async () => {
      await apiRequest(`/api/short-links/${id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await loadLinks(
        links.items.length === 1 ? Math.max(1, links.page - 1) : links.page,
      );
      setNotice("Link e métricas excluídos.");
    });
  }

  async function importHistory() {
    await action(async () => {
      const items = readHistory();
      if (!items.length) {
        setNotice("Não há histórico local neste navegador para importar.");
        return;
      }
      const result = await apiRequest<{ imported: number }>("/api/history", {
        method: "POST",
        body: JSON.stringify({ items }),
      });
      await loadHistory(1);
      setNotice(
        `${result.imported} registro(s) importado(s). Itens já importados não são duplicados.`,
      );
    });
  }

  return (
    <div className="dashboard-stack" aria-busy={busy}>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="status-success" role="status">
          {notice}
        </p>
      )}
      <section className="dashboard-section" aria-labelledby="meus-links">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">Compartilhe e acompanhe</span>
            <h2 id="meus-links">Meus links</h2>
          </div>
          <Link href="/encurtar" className="button">
            Criar link curto
          </Link>
        </div>
        {!links.items.length ? (
          <div className="tool-card empty-dashboard">
            <h3>Seu próximo link começa aqui.</h3>
            <p>
              Crie um link curto para compartilhar e acompanhar os primeiros
              cliques.
            </p>
          </div>
        ) : (
          <ul className="account-list">
            {links.items.map((link) => (
              <li className="account-item" key={link.id}>
                <div className="account-item-heading">
                  <h3>
                    <Link href={`/conta/links/${link.id}`}>
                      {link.title || new URL(link.destinationUrl).hostname}
                    </Link>
                  </h3>
                  <span
                    className={
                      link.isActive ? "success-badge" : "inactive-badge"
                    }
                  >
                    {link.isActive ? "Ativo" : "Desativado"}
                  </span>
                </div>
                <p className="account-url">
                  <code>{link.shortUrl}</code>
                </p>
                <p className="muted account-url">
                  Destino: {link.destinationUrl}
                </p>
                <p>
                  <strong>{link.clicks}</strong> cliques
                </p>
                <div className="action-row">
                  <CopyButton value={link.shortUrl} label="Copiar link curto" />
                  <CopyButton
                    value={link.shareUrl}
                    label="Copiar página pública"
                  />
                  <Link
                    className="button button-secondary"
                    href={`/conta/links/${link.id}`}
                  >
                    Ver métricas
                  </Link>
                  <button
                    className="button button-quiet"
                    disabled={busy}
                    onClick={() => toggle(link)}
                  >
                    {link.isActive ? "Desativar" : "Reativar"}
                  </button>
                  <button
                    className="button button-quiet danger-text"
                    disabled={busy}
                    onClick={() => setConfirmDelete(link.id)}
                  >
                    Excluir link
                  </button>
                </div>
                {confirmDelete === link.id && (
                  <div className="delete-confirmation">
                    <p>
                      Excluir este link e suas métricas? O endereço
                      compartilhado deixará de funcionar.
                    </p>
                    <button
                      className="button"
                      disabled={busy}
                      onClick={() => removeLink(link.id)}
                    >
                      Confirmar exclusão
                    </button>{" "}
                    <button
                      className="button button-secondary"
                      disabled={busy}
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        <Pagination
          label="Páginas dos links"
          page={links.page}
          hasMore={links.hasMore}
          busy={busy}
          onPage={(p) => action(() => loadLinks(p))}
        />
      </section>
      <section className="dashboard-section" aria-labelledby="historico-conta">
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">Disponível nos seus dispositivos</span>
            <h2 id="historico-conta">Histórico da conta</h2>
          </div>
          <button
            className="button button-secondary"
            disabled={busy}
            onClick={importHistory}
          >
            Importar histórico deste navegador
          </button>
        </div>
        <p className="muted">
          Limpezas, UTMs e QR Codes gerados enquanto você está conectado são
          salvos aqui. A importação do histórico local é opcional.
        </p>
        {!history.items.length ? (
          <div className="tool-card empty-dashboard">
            <p>
              Seu histórico está vazio. Use uma ferramenta com a conta conectada
              ou importe os links deste navegador.
            </p>
          </div>
        ) : (
          <ul className="account-list">
            {history.items.map((item) => (
              <li className="account-item" key={item.id}>
                <span className="eyebrow">
                  {item.kind === "clean"
                    ? "Link limpo"
                    : item.kind === "utm"
                      ? "Campanha UTM"
                      : "QR Code"}{" "}
                  · {item.createdAt.slice(0, 10).split("-").reverse().join("/")}
                </span>
                <p className="account-url">
                  <code>{item.resultUrl}</code>
                </p>
                <details>
                  <summary>Ver URL original</summary>
                  <p className="account-url">{item.originalUrl}</p>
                </details>
                <div className="action-row">
                  <CopyButton value={item.resultUrl} />
                  <a
                    className="button button-secondary"
                    href={item.resultUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Abrir
                  </a>
                  <Link
                    className="button button-secondary"
                    href={`/encurtar?url=${encodeURIComponent(item.resultUrl)}`}
                  >
                    Encurtar
                  </Link>
                  <button
                    className="button button-quiet danger-text"
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        await apiRequest(`/api/history/${item.id}`, {
                          method: "DELETE",
                        });
                        await loadHistory(
                          history.items.length === 1
                            ? Math.max(1, history.page - 1)
                            : history.page,
                        );
                      })
                    }
                  >
                    Remover do histórico
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          label="Páginas do histórico"
          page={history.page}
          hasMore={history.hasMore}
          busy={busy}
          onPage={(p) => action(() => loadHistory(p))}
        />
      </section>
    </div>
  );
}

function Pagination({
  label,
  page,
  hasMore,
  busy,
  onPage,
}: {
  label: string;
  page: number;
  hasMore: boolean;
  busy: boolean;
  onPage: (page: number) => void;
}) {
  if (page === 1 && !hasMore) return null;
  return (
    <nav className="pagination" aria-label={label}>
      <button
        className="button button-secondary"
        disabled={busy || page === 1}
        onClick={() => onPage(page - 1)}
      >
        Anterior
      </button>
      <span>Página {page}</span>
      <button
        className="button button-secondary"
        disabled={busy || !hasMore}
        onClick={() => onPage(page + 1)}
      >
        Próxima
      </button>
    </nav>
  );
}

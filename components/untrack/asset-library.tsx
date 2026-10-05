"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { Shortener } from "@/components/shortener";
import { apiRequest, useAction, ActionStatus } from "./shared";
import { useWorkspace } from "./shell";
type Asset = {
  id: string;
  title?: string;
  name?: string;
  slug?: string;
  destinationUrl?: string;
  shortUrl?: string;
  isActive?: boolean;
  expiresAt?: string | null;
  status?: string;
  clicks?: number;
  createdAt: string;
  updatedAt: string;
  client?: { id: string; name: string } | null;
  campaign?: {
    id: string;
    name: string;
    client?: { name: string } | null;
  } | null;
  _count?: { shortLinks: number; channels: number };
};
interface Result {
  items?: Asset[];
  campaigns?: Asset[];
  clients?: { id: string; name: string }[];
  page: number;
  hasMore: boolean;
}
const statuses: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  completed: "Concluída",
  archived: "Arquivada",
  inactive: "Desativado",
  expired: "Expirado",
};
function exportRows(rows: Asset[]) {
  const cell = (value: unknown) =>
    `"${String(value ?? "")
      .replace(/^[=+@-]/, "'$&")
      .replaceAll('"', '""')}"`;
  const csv = [
    ["Nome", "Destino", "Cliente", "Campanha", "Status", "Atualização"],
    ...rows.map((row) => [
      row.title || row.name || row.slug,
      row.destinationUrl,
      row.client?.name || row.campaign?.client?.name,
      row.campaign?.name,
      row.status ?? (row.isActive ? "Ativo" : "Desativado"),
      row.updatedAt,
    ]),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "ativos-selecionados.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function AssetLibrary({ kind }: { kind: "links" | "campaigns" }) {
  const workspace = useWorkspace(),
    canWrite = workspace?.role !== "viewer";
  const params = useSearchParams(),
    router = useRouter(),
    path = usePathname();
  const [revision, setRevision] = useState(0),
    [result, setResult] = useState<Result | null>(null),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [selected, setSelected] = useState<string[]>([]);
  const action = useAction();
  const [showCreate, setShowCreate] = useState(params.get("create") === "1");
  const query = params.toString();
  const endpoint = kind === "links" ? "/api/short-links" : "/api/campaigns";
  useEffect(() => {
    const controller = new AbortController();
    // Synchronize request state when URL filters change.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    setSelected([]);
    apiRequest<Result>(`${endpoint}?${query}`, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setResult(result);
      })
      .catch((error) => {
        if (!controller.signal.aborted) setError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [endpoint, query, revision]);
  const rows = (kind === "links" ? result?.items : result?.campaigns) ?? [];
  function changePage(page: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    router.push(`${path}?${next}`, { scroll: false });
  }
  async function toggle(ids: string[], isActive: boolean) {
    await action.run(async () => {
      await apiRequest("/api/short-links/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, isActive }),
      });
      setRevision((v) => v + 1);
      action.setNotice(
        `${ids.length} link(s) ${isActive ? "ativado(s)" : "desativado(s)"}.`,
      );
    });
  }
  return (
    <section className="workspace-page">
      <header className="workspace-page-heading">
        <div>
          <h1>{kind === "links" ? "Links" : "Campanhas"}</h1>
          <p>
            {kind === "links"
              ? "Sua biblioteca de links, destinos e resultados."
              : "Organize clientes, canais e ativos de cada campanha."}
          </p>
        </div>
        {canWrite && (
          <button className="button" onClick={() => setShowCreate(!showCreate)}>
            {showCreate
              ? "Fechar criação"
              : kind === "links"
                ? "+ Criar link"
                : "+ Nova campanha"}
          </button>
        )}
      </header>
      {showCreate && canWrite && (
        <section className="workspace-panel">
          {kind === "links" ? (
            <>
              <Shortener initialUrl="" />
              <button
                className="button button-secondary"
                onClick={() => {
                  setShowCreate(false);
                  setRevision((v) => v + 1);
                }}
              >
                Concluir e atualizar biblioteca
              </button>
            </>
          ) : (
            <form
              className="library-create"
              onSubmit={(event) => {
                event.preventDefault();
                const form = event.currentTarget,
                  data = new FormData(form);
                void action.run(async () => {
                  await apiRequest("/api/campaigns", {
                    method: "POST",
                    body: JSON.stringify({
                      name: data.get("name"),
                      clientId: data.get("clientId") || undefined,
                    }),
                  });
                  setShowCreate(false);
                  setRevision((v) => v + 1);
                  action.setNotice("Campanha criada.");
                });
              }}
            >
              <label>
                Nome da campanha
                <input required name="name" maxLength={120} />
              </label>
              <label>
                Cliente
                <select name="clientId">
                  <option value="">Sem cliente</option>
                  {result?.clients?.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button" disabled={action.busy}>
                Criar campanha
              </button>
            </form>
          )}
        </section>
      )}
      <ActionStatus {...action} />
      <form
        className="library-filters"
        key={`${query}:${result?.clients?.length ?? 0}:${result?.campaigns?.length ?? 0}`}
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const next = new URLSearchParams();
          for (const [key, value] of data)
            if (String(value)) next.set(key, String(value));
          router.push(`${path}?${next}`, { scroll: false });
        }}
      >
        <label>
          Buscar
          <input
            name="search"
            defaultValue={params.get("search") ?? ""}
            placeholder="Nome ou destino"
            maxLength={120}
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={params.get("status") ?? ""}>
            <option value="">Todos</option>
            {(kind === "links"
              ? ["active", "inactive", "expired"]
              : ["draft", "active", "completed", "archived"]
            ).map((status) => (
              <option value={status} key={status}>
                {kind === "links" && status === "active"
                  ? "Ativo"
                  : statuses[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Cliente
          <select name="clientId" defaultValue={params.get("clientId") ?? ""}>
            <option value="">Todos os clientes</option>
            {result?.clients?.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
        </label>
        {kind === "links" && (
          <label>
            Campanha
            <select
              name="campaignId"
              defaultValue={params.get("campaignId") ?? ""}
            >
              <option value="">Todas</option>
              {result?.campaigns?.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Criado de
          <input
            type="date"
            name="from"
            defaultValue={params.get("from") ?? ""}
          />
        </label>
        <label>
          Até
          <input type="date" name="to" defaultValue={params.get("to") ?? ""} />
        </label>
        <button className="button button-secondary">Filtrar</button>
        <Link href={path}>Limpar filtros</Link>
      </form>
      {loading ? (
        <p role="status" className="workspace-panel">
          Carregando biblioteca…
        </p>
      ) : error ? (
        <div className="workspace-panel" role="alert">
          <strong>Não foi possível carregar</strong>
          <p>{error}</p>
          <button
            className="button button-secondary"
            onClick={() => setRevision((v) => v + 1)}
          >
            Tentar novamente
          </button>
        </div>
      ) : !rows.length ? (
        <div className="workspace-panel">
          <h2>
            {query
              ? "Nenhum resultado para estes filtros"
              : "Sua biblioteca começa aqui"}
          </h2>
          <p>
            {query
              ? "Ajuste os filtros ou limpe a busca."
              : "Use o botão de criação para adicionar o primeiro registro."}
          </p>
        </div>
      ) : (
        <>
          <div className="library-selection">
            <span>{selected.length} selecionado(s)</span>
            <button
              type="button"
              disabled={!selected.length}
              onClick={() =>
                exportRows(rows.filter((row) => selected.includes(row.id)))
              }
            >
              Exportar selecionados (CSV)
            </button>
            {kind === "links" && canWrite && (
              <>
                <button
                  disabled={!selected.length || action.busy}
                  onClick={() => void toggle(selected, true)}
                >
                  Ativar
                </button>
                <button
                  disabled={!selected.length || action.busy}
                  onClick={() => void toggle(selected, false)}
                >
                  Desativar
                </button>
              </>
            )}
          </div>
          <div className="library-table-wrap">
            <table className="library-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Selecionar registros desta página"
                      checked={
                        rows.length > 0 && selected.length === rows.length
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked ? rows.map((row) => row.id) : [],
                        )
                      }
                    />
                  </th>
                  <th>Nome e destino</th>
                  <th>Contexto</th>
                  <th>Status</th>
                  <th>{kind === "links" ? "Cliques (total)" : "Ativos"}</th>
                  <th>Atualização</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const status =
                    row.expiresAt && new Date(row.expiresAt) <= new Date()
                      ? "Expirado"
                      : row.status
                        ? statuses[row.status]
                        : row.isActive
                          ? "Ativo"
                          : "Desativado";
                  const detail =
                    kind === "links"
                      ? `/conta/links/${row.id}`
                      : `/untrack/campaigns/${row.id}`;
                  return (
                    <tr key={row.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Selecionar ${row.title || row.name || row.slug}`}
                          checked={selected.includes(row.id)}
                          onChange={(event) =>
                            setSelected((values) =>
                              event.target.checked
                                ? [...values, row.id]
                                : values.filter((id) => id !== row.id),
                            )
                          }
                        />
                      </td>
                      <td>
                        <Link
                          href={`${detail}?returnTo=${encodeURIComponent(`${path}?${query}`)}`}
                        >
                          {row.title || row.name || row.slug}
                        </Link>
                        {row.destinationUrl && (
                          <details>
                            <summary>Consultar destino</summary>
                            <code>{row.destinationUrl}</code>
                          </details>
                        )}
                      </td>
                      <td>
                        {row.client?.name ||
                          row.campaign?.client?.name ||
                          "Sem cliente"}
                        {row.campaign && <small>{row.campaign.name}</small>}
                      </td>
                      <td>
                        <span className="library-status">{status}</span>
                      </td>
                      <td>
                        {kind === "links"
                          ? row.clicks
                          : (row._count?.shortLinks ?? 0) +
                            (row._count?.channels ?? 0)}
                      </td>
                      <td>
                        <time dateTime={row.updatedAt}>
                          {new Date(row.updatedAt).toLocaleDateString("pt-BR")}
                        </time>
                      </td>
                      <td>
                        <details className="row-menu">
                          <summary>Opções</summary>
                          {row.shortUrl && (
                            <CopyButton
                              value={row.shortUrl}
                              label="Copiar link"
                            />
                          )}
                          {row.destinationUrl && (
                            <a
                              href={row.destinationUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Abrir destino ↗
                            </a>
                          )}
                          <Link
                            href={`${detail}?returnTo=${encodeURIComponent(`${path}?${query}`)}`}
                          >
                            {kind === "links"
                              ? "Ver métricas"
                              : "Abrir campanha"}
                          </Link>
                          {kind === "links" && canWrite && (
                            <button
                              disabled={action.busy}
                              onClick={() =>
                                void toggle([row.id], !row.isActive)
                              }
                            >
                              {row.isActive ? "Desativar" : "Ativar"}
                            </button>
                          )}
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="library-pagination">
            <button
              className="button button-secondary"
              disabled={(result?.page ?? 1) <= 1}
              onClick={() => changePage((result?.page ?? 1) - 1)}
            >
              Anterior
            </button>
            <span>Página {result?.page}</span>
            <button
              className="button button-secondary"
              disabled={!result?.hasMore}
              onClick={() => changePage((result?.page ?? 1) + 1)}
            >
              Próxima
            </button>
          </div>
        </>
      )}
    </section>
  );
}

"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
export { apiRequest };
export function useCollection<T>(module: string, search = "") {
  const [items, setItems] = useState<T[]>([]), [loading, setLoading] = useState(true), [error, setError] = useState("");
  const [page, setPage] = useState(1), [hasMore, setHasMore] = useState(false);
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { const data = await apiRequest<{ items: T[]; hasMore: boolean }>(`/api/workspace/${module}?page=${page}&search=${encodeURIComponent(search)}`); setItems(data.items); setHasMore(data.hasMore); }
    catch (error) { setError(error instanceof Error ? error.message : "Falha ao carregar."); }
    finally { setLoading(false); }
  }, [module, page, search]);
  useEffect(() => { void refresh(); }, [refresh]);
  return { items, loading, error, refresh, page, setPage, hasMore };
}
export function CollectionState({ loading, error, empty }: { loading: boolean; error: string; empty: boolean }) {
  return loading ? <p role="status">Carregando...</p> : error ? <p role="alert" className="form-error">{error}</p> : empty ? <p>Nenhum registro neste workspace.</p> : null;
}
export function Pager({ page, setPage, hasMore }: { page: number; setPage: (page: number) => void; hasMore: boolean }) {
  return <div className="action-row"><button className="button button-secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page}</span><button className="button button-secondary" disabled={!hasMore} onClick={() => setPage(page + 1)}>Próxima</button></div>;
}
export function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function run(action: () => Promise<void>) { setBusy(true); setError(""); setNotice(""); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : "Não foi possível concluir."); } finally { setBusy(false); } }
  return { busy, error, notice, setNotice, run };
}
export function ActionStatus({ busy, error, notice }: ReturnType<typeof useAction>) {
  return <div aria-live="polite">{busy && <p>Processando...</p>}{error && <p role="alert" className="form-error">{error}</p>}{notice && <p role="status">{notice}</p>}</div>;
}

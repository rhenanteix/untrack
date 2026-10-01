"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/client/api";
export { apiRequest };
export function useCollection<T>(module: string, search = "") {
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);
  const key = `/api/workspace/${module}?page=${page}&search=${encodeURIComponent(search)}`;
  const [result, setResult] = useState<{
    key: string;
    items: T[];
    hasMore: boolean;
    error: string;
  }>({ key: "", items: [], hasMore: false, error: "" });
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const data = await apiRequest<{ items: T[]; hasMore: boolean }>(key);
      setResult({ key, ...data, error: "" });
    } catch (error) {
      setResult({
        key,
        items: [],
        hasMore: false,
        error: error instanceof Error ? error.message : "Falha ao carregar.",
      });
    } finally {
      setRefreshing(false);
    }
  }, [key]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: T[]; hasMore: boolean }>(key, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted) setResult({ key, ...data, error: "" });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted)
          setResult({ key, items: [], hasMore: false, error: error.message });
      });
    return () => controller.abort();
  }, [key]);
  const current = result.key === key;
  return {
    items: current ? result.items : [],
    loading: !current || refreshing,
    error: current ? result.error : "",
    refresh,
    page,
    setPage,
    hasMore: current && result.hasMore,
  };
}
export function CollectionState({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: string;
  empty: boolean;
}) {
  return loading ? (
    <p role="status">Carregando...</p>
  ) : error ? (
    <p role="alert" className="form-error">
      {error}
    </p>
  ) : empty ? (
    <p>Nenhum registro neste workspace.</p>
  ) : null;
}
export function Pager({
  page,
  setPage,
  hasMore,
}: {
  page: number;
  setPage: (page: number) => void;
  hasMore: boolean;
}) {
  return (
    <div className="action-row">
      <button
        className="button button-secondary"
        disabled={page === 1}
        onClick={() => setPage(page - 1)}
      >
        Anterior
      </button>
      <span>Página {page}</span>
      <button
        className="button button-secondary"
        disabled={!hasMore}
        onClick={() => setPage(page + 1)}
      >
        Próxima
      </button>
    </div>
  );
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [failure, setFailure] = useState<Error | null>(null);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setFailure(null);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (error) {
      setFailure(
        error instanceof Error
          ? error
          : new Error("Não foi possível concluir."),
      );
      setError(
        error instanceof Error ? error.message : "Não foi possível concluir.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, failure, notice, setNotice, run };
}
export function ActionStatus({
  busy,
  error,
  notice,
}: ReturnType<typeof useAction>) {
  return (
    <div aria-live="polite">
      {busy && <p>Processando...</p>}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
    </div>
  );
}

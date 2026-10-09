"use client";
import { useEffect, useState } from "react";
import {
  platforms,
  instructions,
  goalLabels,
  installationSnippet,
  consentSnippet,
} from "@/modules/pixel/installation";
type Source = { id: string; allowedOrigins: string[] };
type Status = {
  status: string;
  accepted: number;
  test: { id: string; receivedAt: string; state: string } | null;
};
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store" });
  const body = await response.json();
  if (!response.ok)
    throw new Error(
      body.code === "FORBIDDEN"
        ? "Peça a um administrador para cadastrar o site."
        : "Não foi possível concluir. Verifique o endereço, sua permissão e tente novamente.",
    );
  return body;
}
export function PixelSetup() {
  const [platform, setPlatform] =
    useState<(typeof platforms)[number]>("Não sei");
  const [origins, setOrigins] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [site, setSite] = useState<Source | null>(null);
  const [origin, setOrigin] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [testId, setTestId] = useState("");
  const [waiting, setWaiting] = useState(false);
  const [goal, setGoal] = useState<keyof typeof goalLabels>("quote");
  const [targetOrigin, setTargetOrigin] = useState("");
  useEffect(() => {
    api<{ sources: Source[] }>("/api/pixel")
      .then((data) => {
        setOrigin(window.location.origin);
        setSources(data.sources);
        setSite(data.sources[0] ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!site) return;
    let alive = true;
    const refresh = () =>
      api<Status>(`/api/pixel/${site.id}${testId ? `?test=${testId}` : ""}`)
        .then((data) => {
          if (alive) {
            setStatus(data);
            if (data.test) setWaiting(false);
          }
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    void refresh();
    const timer = waiting ? setInterval(refresh, 3000) : undefined;
    const deadline = waiting
      ? setTimeout(() => {
          if (alive) setWaiting(false);
        }, 60000)
      : undefined;
    return () => {
      alive = false;
      clearInterval(timer);
      clearTimeout(deadline);
    };
  }, [site, testId, waiting]);
  async function create() {
    setBusy(true);
    setError("");
    try {
      const result = await api<{ source: Source }>("/api/pixel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origins: origins
            .split(/[\n,]/)
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      setSources((current) => [...current, result.source]);
      setStatus(null);
      setWaiting(false);
      setSite(result.source);
      setTestId("");
      setTargetOrigin("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const snippet = site && origin ? installationSnippet(origin, site.id) : "";
  const testUrl =
    site && testId
      ? `${targetOrigin || site.allowedOrigins[0]}/?linkor_test=${testId}`
      : "";
  return (
    <main className="space-y-6 p-6 max-w-4xl mx-auto">
      <header>
        <h1 className="text-2xl font-semibold">LinkOr Pixel</h1>
        <p>Veja as interações do seu site com autorização dos visitantes.</p>
      </header>
      {error && <p role="alert">{error}</p>}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">1. Cadastre seu site</h2>
        <label className="block">
          Endereços autorizados, um por linha (inclua https:// e sem barra
          final)
          <textarea
            className="block border rounded p-2 w-full"
            value={origins}
            onChange={(e) => setOrigins(e.target.value)}
            placeholder={
              "https://suaempresa.com.br\nhttps://www.suaempresa.com.br"
            }
          />
        </label>
        <p>
          Cadastre www, subdomínios e outros domínios separadamente. Nenhum
          domínio é liberado automaticamente.
        </p>
        <button
          className="button"
          disabled={busy || !origins.trim()}
          onClick={create}
        >
          {busy ? "Salvando…" : "Cadastrar site"}
        </button>
        {sources.length > 0 && (
          <label className="block">
            Site cadastrado{" "}
            <select
              value={site?.id ?? ""}
              onChange={(e) => {
                setSite(sources.find((s) => s.id === e.target.value) ?? null);
                setTestId("");
                setWaiting(false);
                setTargetOrigin("");
              }}
            >
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.allowedOrigins.join(", ")}
                </option>
              ))}
            </select>
          </label>
        )}
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">2. Como seu site foi criado?</h2>
        <select
          aria-label="Como seu site foi criado?"
          value={platform}
          onChange={(e) => setPlatform(e.target.value as typeof platform)}
        >
          {platforms.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
        <p>{instructions[platform]}</p>
        {snippet && (
          <>
            <label className="block">
              Código de instalação
              <textarea
                aria-label="Código de instalação"
                className="block border rounded p-2 w-full font-mono"
                readOnly
                value={snippet}
                rows={3}
              />
            </label>
            <button
              className="button"
              onClick={() =>
                navigator.clipboard
                  .writeText(snippet)
                  .catch(() =>
                    setError("Selecione e copie o código manualmente."),
                  )
              }
            >
              Copiar código
            </button>
          </>
        )}
        <p>
          Escolha apenas uma instalação: código direto ou GTM. O identificador
          do site é público e não é uma senha.
        </p>
        <details>
          <summary>
            Para quem instala: conectar o banner de consentimento
          </summary>
          <pre className="overflow-auto whitespace-pre-wrap">
            {consentSnippet}
          </pre>
          <p>
            Sem essa conexão, nenhum evento é enviado. O consentimento do Google
            não autoriza automaticamente o LinkOr. A recusa ou revogação limpa a
            fila. O Pixel não usa cookies nem armazenamento persistente.
          </p>
        </details>
      </section>
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">3. O que você quer medir?</h2>
        <select
          aria-label="Objetivo"
          value={goal}
          onChange={(e) => setGoal(e.target.value as typeof goal)}
        >
          {Object.entries(goalLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <p>
          Envie ao responsável pelo site: adicione{" "}
          <code>data-linkor-goal=&quot;{goal}&quot;</code> ao botão
          correspondente. O clique será registrado com esse objetivo.
        </p>
        <p>
          Para registrar uma ação concluída, use{" "}
          <code>{`LinkOr.track("custom_event", {goal: "${goal}"})`}</code>{" "}
          somente após a confirmação da aplicação. Um clique em Agendamento ou
          Cadastro não comprova sua conclusão.
        </p>
        <p>
          Compra confirmada: conecte a confirmação do pagamento pelo servidor no
          Data Hub. O Pixel não aceita compras como prova de pagamento.
        </p>
      </section>
      {site && (
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">4. Teste sua instalação</h2>
          <p role="status">{status?.status ?? "Consultando recebimento…"}</p>
          <p>
            O estado usa os últimos 30 minutos. “Não instalado” significa que
            ainda não recebemos evidência; consentimento negado ou um bloqueador
            também podem causar isso.
          </p>
          <label>
            Domínio para testar{" "}
            <select
              value={targetOrigin || site.allowedOrigins[0]}
              onChange={(e) => {
                setStatus(null);
                setTargetOrigin(e.target.value);
                setTestId("");
                setWaiting(false);
              }}
            >
              {site.allowedOrigins.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <button
            className="button"
            onClick={() => {
              setStatus(null);
              setError("");
              setTestId(crypto.randomUUID());
              setWaiting(true);
            }}
          >
            Preparar evento de teste
          </button>
          {testUrl && (
            <>
              <a
                className="button"
                href={testUrl}
                target="_blank"
                rel="noreferrer"
              >
                Abrir meu site para testar
              </a>
              <p>
                Na nova aba, autorize Estatísticas no banner. O Pixel enviará o
                teste automaticamente. Depois volte aqui.
              </p>
            </>
          )}
          {status?.test ? (
            <p role="status">
              Recebimento confirmado em{" "}
              {new Date(status.test.receivedAt).toLocaleString("pt-BR")}.
              Recibo: {status.test.id}.{" "}
              {status.test.state === "normalized"
                ? "Processado pelo Data Hub."
                : "Recebido; aguardando processamento do Data Hub."}
            </p>
          ) : (
            testId && (
              <p role="status">
                {waiting
                  ? "Aguardando recebimento real (até 60 segundos)…"
                  : "Teste ainda não confirmado. Verifique a publicação, o consentimento, os domínios, a conexão e bloqueadores. Você pode tentar novamente."}
              </p>
            )
          )}
          <p>
            Possível duplicidade indica duas cargas do SDK, não apenas uma
            tentativa de reenvio. Precisa de atenção indica fonte desativada,
            rejeições ou atraso de processamento.
          </p>
          <details>
            <summary>Ajuda técnica e debug</summary>
            <p>
              Adicione data-debug=&quot;true&quot; ao script ou execute
              LinkOr.debug(true). O console mostra apenas estados, sem dados
              pessoais. Libere a origem LinkOr em script-src e connect-src da
              CSP. Não contorne escolhas de privacidade ou bloqueadores dos
              visitantes.
            </p>
          </details>
        </section>
      )}
    </main>
  );
}

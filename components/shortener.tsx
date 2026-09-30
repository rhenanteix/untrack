"use client";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { apiRequest } from "@/lib/client/api";
import type { ShortLinkView } from "@/modules/short-links/types";

export function Shortener({ initialUrl = "" }: { initialUrl?: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [result, setResult] = useState<ShortLinkView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await apiRequest<ShortLinkView>("/api/short-links", {
          method: "POST",
          body: JSON.stringify({
            url,
            title: data.get("title"),
            description: data.get("description"),
          }),
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível encurtar.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="tool-stack">
      <form className="tool-card account-form" onSubmit={submit}>
        <label>
          <span>Link de destino</span>
          <input
            type="url"
            required
            maxLength={4096}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemplo.com/seu-link"
          />
        </label>
        <label>
          <span>Título (opcional)</span>
          <input name="title" maxLength={120} placeholder="Minha campanha" />
        </label>
        <label>
          <span>Descrição pública (opcional)</span>
          <textarea
            name="description"
            maxLength={500}
            rows={3}
            placeholder="Uma breve descrição para quem receber o link."
          />
        </label>
        <p className="privacy-note">
          O destino, o título e a descrição ficam visíveis para quem tiver o
          link. Suas métricas ficam disponíveis apenas na sua conta.
        </p>
        <button className="button" disabled={busy} type="submit">
          {busy ? "Encurtando..." : "Criar link curto"}
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {result && (
        <section
          className="result-card"
          aria-label="Link curto criado"
          aria-live="polite"
        >
          <span className="success-badge">✓ Link pronto</span>
          <h2>Menos caracteres. Mais possibilidades.</h2>
          <div className="clean-url">
            <code>{result.shortUrl}</code>
          </div>
          <div className="action-row">
            <CopyButton value={result.shortUrl} label="Copiar link curto" />
            <CopyButton
              value={result.shareUrl}
              label="Copiar página de compartilhamento"
            />
            <Link
              className="button button-secondary"
              href={`/conta/links/${result.id}`}
            >
              Ver métricas
            </Link>
            <Link className="button button-quiet" href={`/l/${result.slug}`}>
              Ver página pública
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

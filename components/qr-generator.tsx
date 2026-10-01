"use client";
import { GuestAccessNotice } from "@/components/guest-access-notice";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { analytics } from "@/lib/client/analytics";

export function QrGenerator() {
  const searchParams = useSearchParams();
  const [url, setUrl] = useState(searchParams.get("url") ?? "");
  const [dataUrl, setDataUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setDataUrl("");
    setLoading(true);
    const submittedUrl = url.trim();
    try {
      const response = await fetch("/api/qr/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: submittedUrl }),
      });
      const data: { dataUrl?: string; error?: string } = await response.json();
      if (!response.ok || !data.dataUrl) {
        throw new Error(data.error ?? "Não conseguimos gerar o QR Code.");
      }
      setDataUrl(data.dataUrl);
      setGeneratedUrl(submittedUrl);
      analytics.track("qr_generated");
    } catch (cause) {
      setError(
        cause instanceof TypeError
          ? "Falha de conexão. Tente novamente."
          : cause instanceof Error
            ? cause.message
            : "Não conseguimos gerar o QR Code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function share() {
    try {
      await navigator.share({ title: "Arrume Meu Link", url: generatedUrl });
    } catch (cause) {
      if (!(cause instanceof Error && cause.name === "AbortError")) {
        setError("Não foi possível compartilhar. Use o botão Copiar.");
      }
    }
  }

  return (
    <div className="tool-stack">
      <form className="tool-card" onSubmit={submit}>
        <label className="input-label" htmlFor="qr-url">
          URL para o QR Code
        </label>
        <div className="input-row">
          <input
            id="qr-url"
            type="url"
            required
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemplo.com"
          />
          <button className="button" type="submit" disabled={loading}>
            {loading ? "Gerando..." : "Gerar QR Code"}
          </button>
        </div>
        <GuestAccessNotice error={error} />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {dataUrl && (
        <section className="result-card qr-result" aria-live="polite">
          <div>
            <span className="success-badge">✓ QR Code pronto</span>
            <h2>Escaneie ou baixe.</h2>
            <p>O código aponta exatamente para a URL informada.</p>
            <div className="clean-url">
              <code>{generatedUrl}</code>
            </div>
            <div className="action-row">
              <a
                className="button"
                href={dataUrl}
                download="arrume-meu-link-qrcode.png"
                onClick={() => analytics.track("qr_downloaded")}
              >
                Baixar PNG
              </a>
              <CopyButton value={generatedUrl} />
              {canShare && (
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={share}
                >
                  Compartilhar
                </button>
              )}
            </div>
          </div>
          {/* A data URL comes from our own QR API and never contains user HTML. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dataUrl}
            alt={`QR Code para ${generatedUrl}`}
            width="280"
            height="280"
          />
        </section>
      )}
    </div>
  );
}

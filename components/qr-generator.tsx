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
  const [foreground, setForeground] = useState("#172A3A");
  const [background, setBackground] = useState("#FFFFFF");
  const [frame, setFrame] = useState<"none" | "rounded" | "scan">("none");
  const [frameText, setFrameText] = useState("ESCANEIE");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<"L" | "M" | "Q" | "H">("M");
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
        body: JSON.stringify({
          url: submittedUrl,
          foreground,
          background,
          frame,
          frameText,
          errorCorrectionLevel,
        }),
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
        <fieldset className="qr-style-controls">
          <legend>Estilo do QR Code</legend>
          <label>
            Cor do código
            <input type="color" value={foreground} onChange={(event) => setForeground(event.target.value)} />
          </label>
          <label>
            Cor de fundo
            <input type="color" value={background} onChange={(event) => setBackground(event.target.value)} />
          </label>
          <label>
            Frame
            <select value={frame} onChange={(event) => setFrame(event.target.value as typeof frame)}>
              <option value="none">Sem frame</option>
              <option value="rounded">Borda arredondada</option>
              <option value="scan">Chamada para ação</option>
            </select>
          </label>
          {frame === "scan" && (
            <label>
              Texto do frame
              <input maxLength={40} value={frameText} onChange={(event) => setFrameText(event.target.value)} />
            </label>
          )}
          <label>
            Correção de erro
            <select value={errorCorrectionLevel} onChange={(event) => setErrorCorrectionLevel(event.target.value as typeof errorCorrectionLevel)}>
              <option value="L">Baixa</option>
              <option value="M">Média</option>
              <option value="Q">Alta</option>
              <option value="H">Máxima</option>
            </select>
          </label>
        </fieldset>
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
            className="qr-result-image"
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

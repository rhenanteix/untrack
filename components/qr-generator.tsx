"use client";
import {
  GuestAccessNotice,
  GuestSignupPrompt,
} from "@/components/guest-access-notice";

import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CopyButton } from "@/components/copy-button";
import { analytics } from "@/lib/client/analytics";

const qrColors = [
  { value: "#172A3A", label: "Marinho" },
  { value: "#111111", label: "Preto" },
  { value: "#5A2D82", label: "Violeta" },
  { value: "#C0365B", label: "Cereja" },
  { value: "#177E89", label: "Petróleo" },
  { value: "#28733A", label: "Verde" },
] as const;

const backgroundColors = [
  { value: "#FFFFFF", label: "Branco" },
  { value: "#F7F3E9", label: "Papel" },
  { value: "#E7EEF7", label: "Azul claro" },
  { value: "#F9E9EE", label: "Rosé" },
  { value: "#E8F2E8", label: "Sálvia" },
] as const;

const frames = [
  { value: "none", label: "Sem moldura" },
  { value: "rounded", label: "Borda" },
  { value: "scan", label: "Faixa" },
] as const;

const patterns = [
  { value: "square", label: "Quadrado" },
  { value: "dots", label: "Pontos" },
  { value: "rounded", label: "Arredondado" },
] as const;

const cornerStyles = [
  { value: "square", label: "Quadrado" },
  { value: "rounded", label: "Suave" },
  { value: "extra-rounded", label: "Circular" },
] as const;

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
  const [pattern, setPattern] = useState<"square" | "dots" | "rounded">(
    "square",
  );
  const [cornerStyle, setCornerStyle] = useState<
    "square" | "rounded" | "extra-rounded"
  >("square");
  const [frameText, setFrameText] = useState("ESCANEIE");
  const [errorCorrectionLevel, setErrorCorrectionLevel] = useState<
    "L" | "M" | "Q" | "H"
  >("M");
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
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
          pattern,
          cornerStyle,
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
      if (response.headers.get("X-Untrack-Anonymous-Use") === "consumed") {
        analytics.track("anonymous_usage_consumed");
        analytics.track("free_tool_completed");
        setShowSignupPrompt(true);
      }
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
      <GuestSignupPrompt
        open={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
      />
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
          <legend>Personalize seu QR Code</legend>
          <div className="qr-control-section">
            <div className="qr-control-heading">
              <span>Cor do código</span>
              <label className="qr-custom-color">
                Personalizar
                <input
                  type="color"
                  value={foreground}
                  onChange={(event) => setForeground(event.target.value)}
                />
              </label>
            </div>
            <div className="qr-color-picker" aria-label="Cor do código">
              {qrColors.map((color) => (
                <button
                  className="qr-color-choice"
                  type="button"
                  key={color.value}
                  aria-label={color.label}
                  aria-pressed={foreground === color.value}
                  onClick={() => setForeground(color.value)}
                >
                  <span style={{ backgroundColor: color.value }} />
                </button>
              ))}
            </div>
          </div>
          <div className="qr-control-section">
            <div className="qr-control-heading">
              <span>Cor de fundo</span>
              <label className="qr-custom-color">
                Personalizar
                <input
                  type="color"
                  value={background}
                  onChange={(event) => setBackground(event.target.value)}
                />
              </label>
            </div>
            <div className="qr-color-picker" aria-label="Cor de fundo">
              {backgroundColors.map((color) => (
                <button
                  className="qr-color-choice"
                  type="button"
                  key={color.value}
                  aria-label={color.label}
                  aria-pressed={background === color.value}
                  onClick={() => setBackground(color.value)}
                >
                  <span style={{ backgroundColor: color.value }} />
                </button>
              ))}
            </div>
          </div>
          <div className="qr-control-section">
            <span className="qr-control-label">Moldura</span>
            <div
              className="qr-visual-options"
              role="group"
              aria-label="Moldura"
            >
              {frames.map((option) => (
                <button
                  className="qr-frame-choice"
                  type="button"
                  key={option.value}
                  aria-pressed={frame === option.value}
                  onClick={() => setFrame(option.value)}
                >
                  <span className="qr-frame-sample" data-frame={option.value}>
                    <i />
                    <b>SCAN</b>
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="qr-style-row">
            <div className="qr-control-section">
              <span className="qr-control-label">Padrão</span>
              <div
                className="qr-visual-options qr-compact-options"
                role="group"
                aria-label="Padrão dos módulos"
              >
                {patterns.map((option) => (
                  <button
                    className="qr-pattern-choice"
                    type="button"
                    key={option.value}
                    aria-pressed={pattern === option.value}
                    onClick={() => setPattern(option.value)}
                  >
                    <span
                      className="qr-pattern-sample"
                      data-pattern={option.value}
                    />
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="qr-control-section">
              <span className="qr-control-label">Cantos</span>
              <div
                className="qr-visual-options qr-compact-options"
                role="group"
                aria-label="Estilo dos cantos"
              >
                {cornerStyles.map((option) => (
                  <button
                    className="qr-corner-choice"
                    type="button"
                    key={option.value}
                    aria-pressed={cornerStyle === option.value}
                    onClick={() => setCornerStyle(option.value)}
                  >
                    <span
                      className="qr-corner-sample"
                      data-corner={option.value}
                    >
                      <i />
                      <b />
                    </span>
                    <span>{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {frame === "scan" && (
            <label className="qr-frame-text">
              Texto do frame
              <input
                maxLength={40}
                value={frameText}
                onChange={(event) => setFrameText(event.target.value)}
              />
            </label>
          )}
          <label className="qr-correction-level">
            Correção de erro
            <select
              value={errorCorrectionLevel}
              onChange={(event) =>
                setErrorCorrectionLevel(
                  event.target.value as typeof errorCorrectionLevel,
                )
              }
            >
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

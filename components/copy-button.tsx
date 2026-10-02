"use client";

import { useState, type ReactNode } from "react";
import { analytics } from "@/lib/client/analytics";

export function CopyButton({
  value,
  label = "Copiar",
  children,
}: {
  value: string;
  label?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  async function copy() {
    setError("");
    try {
      await navigator.clipboard.writeText(value);
      analytics.track("link_copied");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setError(
        "Não foi possível copiar. Selecione o link e copie manualmente.",
      );
    }
  }

  return (
    <>
      <button
        className="button button-secondary"
        type="button"
        onClick={copy}
        aria-label={copied ? "Link copiado!" : label}
        title={copied ? "Link copiado!" : label}
      >
        {children ?? (copied ? "Link copiado!" : label)}
      </button>
      {error && (
        <span className="form-error" role="alert">
          {error}
        </span>
      )}
    </>
  );
}

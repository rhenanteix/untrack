"use client";
import { useEffect, useId, useState } from "react";
import { apiRequest } from "@/lib/client/api";
export function ImageUpload({
  pageId,
  disabled,
  onUploaded,
  currentUrl,
  label = "Envie sua foto ou logo",
  description = "JPG, PNG ou WebP · até 2 MB. A imagem será otimizada.",
}: {
  pageId: string;
  currentUrl?: string | null;
  disabled: boolean;
  onUploaded: (url: string) => void;
  label?: string;
  description?: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const id = useId();
  const [items, setItems] = useState<{ id: string; url: string }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    apiRequest<{ items: { id: string; url: string }[] }>(
      `/api/smart-pages/${pageId}/images`,
      { signal: controller.signal },
    )
      .then((result) => {
        if (!controller.signal.aborted) setItems(result.items);
      })
      .catch(() => {if(!controller.signal.aborted)setError("Não foi possível carregar suas imagens. Reabra a página para tentar novamente.");});
    return () => controller.abort();
  }, [pageId]);
  return (
    <div className="sp-upload">
      <label htmlFor={id}>
        <strong>{label}</strong>
        <span>{description}</span>
      </label>
      <input
        id={id}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        disabled={disabled || busy}
        aria-describedby={`${id}-status`}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          event.target.value = "";
          setError("");
          if (file.size > 2 * 1024 * 1024) {
            setError("A imagem excede 2 MB. Escolha um arquivo menor.");
            return;
          }
          setBusy(true);
          try {
            const result = await apiRequest<{ url: string }>(
              `/api/smart-pages/${pageId}/images`,
              {
                method: "POST",
                headers: { "Content-Type": file.type },
                body: file,
              },
            );
            onUploaded(result.url);
            const library = await apiRequest<{
              items: { id: string; url: string }[];
            }>(`/api/smart-pages/${pageId}/images`);
            setItems(library.items);
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "Não foi possível enviar a imagem.",
            );
          } finally {
            setBusy(false);
          }
        }}
      />
      {items.length > 0 && (
        <details>
          <summary>Suas imagens ({items.length}/10)</summary>
          <ul className="sp-image-library">
            {items.map((image) => (
              <li key={image.id}>
                <button
                  type="button"
                  disabled={disabled || busy}
                  onClick={() => onUploaded(image.url)}
                  aria-label="Usar imagem"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt="Imagem enviada"
                    width={56}
                    height={56}
                  />
                </button>
                <button
                  type="button"
                  disabled={disabled || busy || currentUrl === image.url}
                  onClick={async () => {
                    setBusy(true);
                    setError("");
                    try {
                      await apiRequest(`/api/smart-page-images/${image.id}`, {
                        method: "DELETE",
                      });
                      setItems((current) =>
                        current.filter((item) => item.id !== image.id),
                      );
                    } catch (error) {
                      setError(
                        error instanceof Error
                          ? error.message
                          : "Não foi possível excluir.",
                      );
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Excluir
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
      <div id={`${id}-status`} aria-live="polite">
        {busy ? (
          "Enviando imagem…"
        ) : error ? (
          <span role="alert" className="sp-field-error">
            {error}
          </span>
        ) : (
          "Depois do envio, confira a prévia e salve o perfil."
        )}
      </div>
    </div>
  );
}

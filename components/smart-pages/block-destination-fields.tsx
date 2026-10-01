"use client";

import { useId, useState, useEffect, useRef } from "react";
import { SmartField } from "./smart-form";

export function BlockDestinationFields({
  links,
  initialUrl = "",
  initialLinkId,
}: {
  links: { id: string; title: string | null; slug: string }[];
  initialUrl?: string;
  initialLinkId?: string | null;
}) {
  const id = useId();
  const [mode, setMode] = useState(initialLinkId ? "managed" : "external");
  const [url, setUrl] = useState(initialUrl);
  const [linkId, setLinkId] = useState(initialLinkId ?? "");
  const fieldset = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    const form = fieldset.current?.closest("form");
    const reset = () => {
      setUrl(initialUrl);
      setLinkId(initialLinkId ?? "");
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [initialUrl, initialLinkId]);
  return (
    <fieldset ref={fieldset} className="sp-destination-choice">
      <legend>Destino do botão</legend>
      <div className="sp-destination-options">
        <label>
          <input
            type="radio"
            name={`${id}-destination-mode`}
            checked={mode === "external"}
            onChange={() => setMode("external")}
          />{" "}
          URL externa
        </label>
        <label>
          <input
            type="radio"
            name={`${id}-destination-mode`}
            checked={mode === "managed"}
            onChange={() => setMode("managed")}
          />{" "}
          Link gerenciado
        </label>
      </div>
      {mode === "external" ? (
        <SmartField hint="Cole o endereço completo. O botão abrirá este destino diretamente.">
          URL externa
          <input
            type="url"
            required
            name="destinationUrl"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://exemplo.com"
          />
        </SmartField>
      ) : (
        <SmartField hint="Usa um link deste workspace e acompanha futuras alterações do destino.">
          Link gerenciado
          <select
            required
            name="linkId"
            value={linkId}
            onChange={(event) => setLinkId(event.target.value)}
          >
            <option value="">Selecione um link</option>
            {links.map((link) => (
              <option key={link.id} value={link.id}>
                {link.title || link.slug}
              </option>
            ))}
          </select>
        </SmartField>
      )}
      {mode === "managed" && links.length === 0 && (
        <p>Crie um link na biblioteca de Links para usá-lo aqui.</p>
      )}
    </fieldset>
  );
}

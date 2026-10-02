"use client";

import { useSyncExternalStore } from "react";
import { FiCheck, FiX } from "react-icons/fi";

type ChecklistItem = {
  label: string;
  complete: boolean;
};

const dismissedKey = "linkor-setup-checklist-dismissed";
const dismissedEvent = "linkor-setup-checklist-changed";

function subscribe(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(dismissedEvent, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(dismissedEvent, listener);
  };
}

function isDismissed() {
  return window.localStorage.getItem(dismissedKey) === "true";
}

export function SetupChecklist({ items }: { items: ChecklistItem[] }) {
  const dismissed = useSyncExternalStore(subscribe, isDismissed, () => false);
  const completeCount = items.filter((item) => item.complete).length;
  const complete = completeCount === items.length;

  if (dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(dismissedKey, "true");
    window.dispatchEvent(new Event(dismissedEvent));
  }

  return (
    <section className="setup-checklist workspace-panel" aria-labelledby="setup-checklist-heading">
      <div className="setup-checklist-heading">
        <div>
          <span className="eyebrow">Comece por aqui</span>
          <h2 id="setup-checklist-heading">{complete ? "Seu setup está pronto" : `${completeCount} de ${items.length} concluídos`}</h2>
        </div>
        {complete ? <button type="button" onClick={dismiss} aria-label="Fechar checklist"><FiX aria-hidden="true" /></button> : null}
      </div>
      {complete ? <p>Você criou, publicou e recebeu uma primeira interação. O LinkOr já está trabalhando com seus dados reais.</p> : <><ol>{items.map((item) => <li key={item.label} data-complete={item.complete}>{item.complete ? <FiCheck aria-hidden="true" /> : <span aria-hidden="true" />}{item.label}</li>)}</ol><div className="setup-checklist-progress" aria-label={`${completeCount} de ${items.length} concluídos`}><span style={{ width: `${(completeCount / items.length) * 100}%` }} /></div></>}
    </section>
  );
}
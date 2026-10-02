"use client";

import Link from "next/link";
import { useState } from "react";
import { FiLock, FiX } from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";

type PremiumGateProps = {
  feature: string;
  description: string;
  children?: React.ReactNode;
};

export function PremiumGate({
  feature,
  description,
  children,
}: PremiumGateProps) {
  const [open, setOpen] = useState(false);

  function showGate() {
    analytics.track("premium_feature_clicked", { location: feature });
    setOpen(true);
  }

  return (
    <>
      <button className="premium-gate-trigger" type="button" onClick={showGate}>
        <FiLock aria-hidden="true" />
        {children ?? "Conhecer Premium"}
      </button>
      {open ? (
        <div className="premium-gate-backdrop" role="presentation">
          <section
            className="premium-gate-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="premium-gate-title"
          >
            <button
              className="premium-gate-close"
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fechar"
            >
              <FiX aria-hidden="true" />
            </button>
            <span className="eyebrow">Recurso Premium</span>
            <h2 id="premium-gate-title">{feature}</h2>
            <p>{description}</p>
            <p>Disponível no LinkOr Premium por R$29,90/mês.</p>
            <div className="premium-gate-actions">
              <Link href="/upgrade" onClick={() => analytics.track("upgrade_clicked")}>
                Conhecer Premium
              </Link>
              <button type="button" onClick={() => setOpen(false)}>
                Agora não
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
"use client";

import { useEffect, useState } from "react";
import { FiCheck } from "react-icons/fi";
import { BrandLogo } from "@/components/brand-logo";
import { analytics } from "@/lib/client/analytics";

const premiumBenefits = [
  "Analytics avançado",
  "Mais Smart Pages, Smart Cards e campanhas",
  "Domínio personalizado e remoção da marca LinkOr",
  "SEO, QR Codes, exportações, pixels e tracking avançados",
];

export function UpgradePage({ premium }: { premium: boolean }) {
  const [notice, setNotice] = useState("");

  useEffect(() => {
    analytics.track("upgrade_viewed");
  }, []);

  return (
    <section className="upgrade-page shell page-section">
      <BrandLogo size="lg" />
      <header className="upgrade-heading">
        <span className="eyebrow">Planos</span>
        <h1>Cresça com o LinkOr</h1>
        <p>
          Comece gratuitamente e desbloqueie ferramentas avançadas quando
          precisar crescer.
        </p>
      </header>
      <div className="upgrade-plans">
        <article>
          <span className="eyebrow">Free</span>
          <strong>R$ 0</strong>
          <p>Links, uma Smart Page, um Smart Card e métricas essenciais.</p>
        </article>
        <article className="upgrade-plan-featured">
          <span className="eyebrow">Premium</span>
          <strong>R$ 29,90 <small>/mês</small></strong>
          <ul>
            {premiumBenefits.map((benefit) => (
              <li key={benefit}>
                <FiCheck aria-hidden="true" />
                {benefit}
              </li>
            ))}
          </ul>
          {premium ? (
            <p role="status">Seu workspace já usa o LinkOr Premium.</p>
          ) : (
            <button
              className="button"
              type="button"
              onClick={() => {
                analytics.track("upgrade_clicked", { location: "upgrade" });
                setNotice(
                  "A cobrança ainda não está conectada. Nenhuma compra será realizada agora.",
                );
              }}
            >
              Começar Premium
            </button>
          )}
          {notice ? <p role="status">{notice}</p> : null}
        </article>
      </div>
    </section>
  );
}
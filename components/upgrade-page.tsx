"use client";

import { useEffect } from "react";
import Link from "next/link";
import { FiCheck } from "react-icons/fi";
import { BrandLogo } from "@/components/brand-logo";
import { analytics } from "@/lib/client/analytics";
import type { AccountAccess } from "@/modules/billing/account-access";

const premiumBenefits = [
  "Analytics avançado",
  "Mais Smart Pages, Smart Cards e campanhas",
  "Domínio personalizado e remoção da marca LinkOr",
  "SEO, QR Codes, exportações, pixels e tracking avançados",
];

export function UpgradePage({ access }: { access: AccountAccess }) {

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
          {access.accessSource === "subscription" ? (
            <p role="status">Sua conta usa o LinkOr Premium.</p>
          ) : access.accessSource === "trial" ? (
            <p role="status">
              Seu Teste Premium está ativo por mais {access.daysRemaining} {access.daysRemaining === 1 ? "dia" : "dias"}.
            </p>
          ) : (
            <>
              <Link
                className="button"
                href="/teste-premium"
                onClick={() => analytics.track("upgrade_clicked", { location: "upgrade" })}
              >
                Começar teste Premium
              </Link>
              <p role="status">
                Premium ainda não está disponível para compra. Nenhuma cobrança será realizada agora.
              </p>
            </>
          )}
        </article>
      </div>
    </section>
  );
}
import type { Metadata } from "next";
import Link from "next/link";
import { CommercialPageTracker } from "@/components/commercial-tracking";
import { premiumPrice } from "@/modules/billing/plans";

export const metadata: Metadata = {
  title: "Preços",
  description:
    "Comece gratuitamente e encontre o plano certo para operar seus links em escala.",
  alternates: { canonical: "/precos" },
  openGraph: {
    title: "Preços | LinkOr",
    description:
      "Comece gratuitamente e encontre o plano certo para operar seus links em escala.",
    url: "/precos",
  },
};

const plans = [
  {
    name: "Free",
    message: "R$ 0",
    benefits: [
      "UTM Builder",
      "10 links, 1 Smart Page e 1 Smart Card",
      "3 QR Codes e 1 campanha",
      "Analytics básicos por 7 dias",
    ],
  },
  {
    name: "Premium",
    message: `${premiumPrice}/mês`,
    benefits: [
      "Analytics avançado e histórico ampliado",
      "Mais Smart Pages, Smart Cards e campanhas",
      "Domínio personalizado e SEO avançado",
      "QR avançado, exportações e pixels",
    ],
  },
] as const;

export default function PricingPage() {
  return (
    <section className="pricing-page">
      <CommercialPageTracker event="pricing_viewed" />
      <div className="shell">
        <div className="pricing-heading">
          <span className="eyebrow">Preços</span>
          <h1>Cresça com o LinkOr</h1>
          <p>
            Comece gratuitamente e desbloqueie ferramentas avançadas quando
            precisar crescer.
          </p>
        </div>
        <div className="pricing-grid">
          {plans.map((plan) => (
            <article key={plan.name} className="pricing-plan">
              <h2>{plan.name}</h2>
              <p>{plan.message}</p>
              <ul>
                {plan.benefits.map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
              <Link
                className="button button-secondary"
                href={plan.name === "Free" ? "/cadastro" : "/upgrade"}
              >
                {plan.name === "Free" ? "Começar grátis" : "Conhecer Premium"}
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

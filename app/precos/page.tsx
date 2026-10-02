import type { Metadata } from "next";
import Link from "next/link";
import { CommercialPageTracker } from "@/components/commercial-tracking";

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
    message: "Comece sem pagar.",
    benefits: [
      "UTM Builder",
      "QR Codes",
      "Short Links",
      "Link Cleaner e Analyzer",
    ],
  },
  {
    name: "Pro",
    message: "Entenda e otimize seus links.",
    benefits: [
      "Analytics de links",
      "Smart Pages",
      "Campaigns",
      "WhatsApp e recursos avançados",
    ],
  },
  {
    name: "Business",
    message: "Opere seus links em escala.",
    benefits: [
      "Times e permissões",
      "Campanhas em colaboração",
      "Projetos e organização",
      "Recursos empresariais",
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
          <h1>Comece com uma ferramenta. Cresça na plataforma.</h1>
          <p>
            Escolha o nível de controle que seu trabalho com links precisa.
            Valores e contratação são definidos no seu espaço de trabalho.
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
              <Link className="button button-secondary" href="/cadastro">
                Começar grátis
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

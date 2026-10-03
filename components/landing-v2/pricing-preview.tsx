"use client";

import Link from "next/link";
import { FiCheck } from "react-icons/fi";
import { demoPricing } from "./landing-v2-data";

export function PricingPreview() {
  return (
    <section className="lv2-pricing">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Preços</span>
          <h2 className="lv2-section-title">Comece grátis.</h2>
          <p className="lv2-section-description">
            Crie sua conta gratuita e evolua quando precisar.
          </p>
        </div>

        <div className="lv2-pricing-grid">
          <article className="lv2-pricing-card">
            <span className="lv2-eyebrow">Free</span>
            <strong>
              {demoPricing.free.price}
              <small>{demoPricing.free.period}</small>
            </strong>
            <ul>
              {demoPricing.free.benefits.map((benefit) => (
                <li key={benefit}>
                  <FiCheck /> {benefit}
                </li>
              ))}
            </ul>
            <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-ghost lv2-btn-full">
              Começar grátis
            </Link>
          </article>

          <article className="lv2-pricing-card lv2-pricing-card--featured">
            <span className="lv2-eyebrow">Premium</span>
            <strong>
              {demoPricing.premium.price}
              <small>{demoPricing.premium.period}</small>
            </strong>
            <ul>
              {demoPricing.premium.benefits.map((benefit) => (
                <li key={benefit}>
                  <FiCheck /> {benefit}
                </li>
              ))}
            </ul>
            <Link href="/upgrade" className="lv2-btn lv2-btn-primary lv2-btn-full">
              Conhecer Premium
            </Link>
          </article>
        </div>
      </div>
    </section>
  );
}

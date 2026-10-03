"use client";

import Link from "next/link";
import { demoUseCases } from "./landing-v2-data";

export function UseCases() {
  return (
    <section className="lv2-usecases">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Use cases</span>
          <h2 className="lv2-section-title">
            Feito para diferentes perfis.
          </h2>
        </div>

        <div className="lv2-usecases-grid">
          {demoUseCases.map((uc) => (
            <article key={uc.title} className="lv2-usecase-card">
              <h3>{uc.title}</h3>
              <p>{uc.description}</p>
              <Link href="/cadastro?next=/conta" className="lv2-text-link">
                Começar grátis
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

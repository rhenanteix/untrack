"use client";

import Link from "next/link";

export function FinalCTA() {
  return (
    <section className="lv2-final">
      <div className="lv2-shell">
        <h2 className="lv2-final-title">
          Seu próximo clique pode dizer muito mais.
        </h2>
        <p className="lv2-final-subtitle">
          Crie, distribua e entenda sua presença digital com o LinkOr.
        </p>
        <div className="lv2-final-actions">
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Começar grátis
          </Link>
          <Link href="#playground" className="lv2-btn lv2-btn-ghost">
            Explorar o produto
          </Link>
        </div>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { demoTemplates } from "./landing-v2-data";

export function TemplateShowcase() {
  return (
    <section className="lv2-templates">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Templates</span>
          <h2 className="lv2-section-title">
            Comece com um template.
          </h2>
          <p className="lv2-section-description">
            Escolha um modelo e personalize com seu conteúdo.
          </p>
        </div>

        <div className="lv2-templates-grid">
          {demoTemplates.map((template) => (
            <article key={template.id} className="lv2-template-card">
              <div className="lv2-template-preview" />
              <h3>{template.name}</h3>
              <p>{template.description}</p>
              <Link href="/cadastro?next=/conta" className="lv2-text-link">
                Usar template
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

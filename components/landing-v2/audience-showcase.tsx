"use client";

import Link from "next/link";
import { demoAudience } from "./landing-v2-data";

export function AudienceShowcase() {
  return (
    <section className="lv2-audience">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Audience</span>
          <h2 className="lv2-section-title">
            Do clique ao relacionamento.
          </h2>
          <p className="lv2-section-description">
            Acompanhe a jornada de cada pessoa que interage com sua presença
            digital.
          </p>
        </div>

        <div className="lv2-audience-layout">
          <div className="lv2-audience-profile">
            <div className="lv2-audience-avatar" />
            <strong>{demoAudience.name}</strong>
            <div className="lv2-audience-meta">
              <div>
                <span>Origem</span>
                <strong>{demoAudience.origin}</strong>
              </div>
              <div>
                <span>Campanha</span>
                <strong>{demoAudience.campaign}</strong>
              </div>
              <div>
                <span>First touch</span>
                <strong>{demoAudience.firstTouch}</strong>
              </div>
              <div>
                <span>Last touch</span>
                <strong>{demoAudience.lastTouch}</strong>
              </div>
            </div>
          </div>

          <div className="lv2-audience-timeline">
            {demoAudience.timeline.map((item) => (
              <div key={item.time} className="lv2-audience-timeline-item">
                <span className="lv2-audience-timeline-time">{item.time}</span>
                <div className="lv2-audience-timeline-dot" />
                <span className="lv2-audience-timeline-action">
                  {item.action}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="lv2-audience-actions">
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Começar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

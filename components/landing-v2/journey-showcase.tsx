"use client";

import Link from "next/link";
import { FiArrowDown } from "react-icons/fi";

export function JourneyShowcase() {
  return (
    <section className="lv2-journey">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Jornada</span>
          <h2 className="lv2-section-title">
            Veja o caminho, não apenas o clique.
          </h2>
          <p className="lv2-section-description">
            Entenda cada passo da jornada, da origem à conversão.
          </p>
        </div>

        <div className="lv2-journey-visual">
          <div className="lv2-journey-path">
            {["Instagram", "Smart Page", "Produto / Conteúdo", "WhatsApp", "Lead"].map(
              (step, index) => (
                <div key={step} className="lv2-journey-step">
                  <div className="lv2-journey-step-node">{index + 1}</div>
                  <span>{step}</span>
                  {index < 4 && (
                    <div className="lv2-journey-step-arrow">
                      <FiArrowDown />
                    </div>
                  )}
                </div>
              ),
            )}
          </div>

          <div className="lv2-journey-details">
            <div className="lv2-journey-detail">
              <span>Origem</span>
              <strong>Instagram</strong>
            </div>
            <div className="lv2-journey-detail">
              <span>Campanha</span>
              <strong>Lançamento Outubro</strong>
            </div>
            <div className="lv2-journey-detail">
              <span>Interações</span>
              <strong>3</strong>
            </div>
            <div className="lv2-journey-detail">
              <span>Objetivo</span>
              <strong>Contato</strong>
            </div>
            <div className="lv2-journey-detail">
              <span>Conversão</span>
              <strong>Lead</strong>
            </div>
          </div>
        </div>

        <div className="lv2-journey-actions">
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Começar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

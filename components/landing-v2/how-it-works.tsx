"use client";

import { FiFileText, FiShare2, FiBarChart2, FiTarget } from "react-icons/fi";
import { demoJourney } from "./landing-v2-data";

const iconMap: Record<string, typeof FiFileText> = {
  "01": FiFileText,
  "02": FiShare2,
  "03": FiBarChart2,
  "04": FiTarget,
};

export function HowItWorks() {
  return (
    <section className="lv2-how">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Como funciona</span>
          <h2 className="lv2-section-title">Comece em quatro passos.</h2>
        </div>

        <div className="lv2-how-grid">
          {demoJourney.steps.map((step) => {
            const Icon = iconMap[step.number] || FiFileText;
            return (
              <div key={step.number} className="lv2-how-card">
                <div className="lv2-how-card-number">
                  <Icon />
                  <span>{step.number}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

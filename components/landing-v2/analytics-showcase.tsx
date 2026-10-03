"use client";

import { useState } from "react";
import Link from "next/link";
import { demoAnalytics } from "./landing-v2-data";

type Period = keyof typeof demoAnalytics;

export function AnalyticsShowcase() {
  const [period, setPeriod] = useState<Period>("7d");
  const data = demoAnalytics[period];

  return (
    <section className="lv2-analytics">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Analytics</span>
          <h2 className="lv2-section-title">
            Pare de contar apenas cliques.
          </h2>
          <p className="lv2-section-description">
            Entenda de onde as pessoas vieram, o que acessaram e quais ações
            realizaram.
          </p>
        </div>

        <div className="lv2-analytics-layout">
          <div className="lv2-analytics-mock">
            <div className="lv2-analytics-header">
              <strong>Exemplo demonstrativo</strong>
              <span>Campanha Lançamento Outubro</span>
            </div>
            <div className="lv2-analytics-metrics">
              <div className="lv2-analytics-metric">
                <span>Visitantes</span>
                <strong>{data.visitors.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="lv2-analytics-metric">
                <span>Cliques</span>
                <strong>{data.clicks.toLocaleString("pt-BR")}</strong>
              </div>
              <div className="lv2-analytics-metric">
                <span>Conversões</span>
                <strong>{data.conversions.toLocaleString("pt-BR")}</strong>
              </div>
            </div>
            <div className="lv2-analytics-sources">
              {data.sources.map((source) => (
                <div key={source.name} className="lv2-source-bar">
                  <div className="lv2-source-bar-info">
                    <span>{source.name}</span>
                    <strong>{source.percent}%</strong>
                  </div>
                  <div className="lv2-source-bar-track">
                    <div
                      className="lv2-source-bar-fill"
                      style={{ width: `${source.percent}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lv2-analytics-side">
            <div className="lv2-analytics-periods">
              {(["7d", "30d", "90d"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`lv2-period-btn ${
                    period === p ? "lv2-period-btn--active" : ""
                  }`}
                  onClick={() => setPeriod(p)}
                >
                  {p === "7d" ? "7 dias" : p === "30d" ? "30 dias" : "90 dias"}
                </button>
              ))}
            </div>
            <div className="lv2-analytics-actions">
              <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
                Começar grátis
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

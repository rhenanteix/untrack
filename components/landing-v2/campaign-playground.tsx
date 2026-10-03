"use client";

import { useState } from "react";
import {
  FaInstagram,
  FaQrcode,
  FaGoogle,
  FaWhatsapp,
  FaLinkedinIn,
} from "react-icons/fa6";
import { FiMail, FiLink, FiArrowRight } from "react-icons/fi";
import { demoCampaigns, demoPlaygroundMetrics } from "./landing-v2-data";

const sources = [
  { id: "instagram", label: "Instagram", Icon: FaInstagram },
  { id: "qr", label: "QR Code", Icon: FaQrcode },
  { id: "google", label: "Google", Icon: FaGoogle },
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp },
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedinIn },
] as const;

const journeyIcons: Record<string, typeof FiMail> = {
  Instagram: FaInstagram,
  "QR Code": FaQrcode,
  Google: FaGoogle,
  WhatsApp: FaWhatsapp,
  LinkedIn: FaLinkedinIn,
  "Smart Page": FiLink,
  Formulário: FiMail,
  CTA: FiMail,
  Contato: FiMail,
  Link: FiLink,
  Lead: FiMail,
};

export function CampaignPlayground() {
  const [activeSource, setActiveSource] = useState<string>(sources[0].id);
  const sourceKey = activeSource as keyof typeof demoCampaigns;
  const campaign = demoCampaigns[sourceKey];

  return (
    <section className="lv2-playground" id="playground">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Playground</span>
          <h2 className="lv2-section-title">
            Veja o caminho de cada resultado.
          </h2>
          <p className="lv2-section-description">
            Escolha uma origem e veja como o LinkOr conecta canal, conteúdo,
            interação e conversão.
          </p>
        </div>

        <div className="lv2-playground-layout">
          <div className="lv2-playground-controls">
            {sources.map((source) => (
              <button
                key={source.id}
                type="button"
                className={
                  "lv2-source-btn" +
                  (activeSource === source.id ? " lv2-source-btn--active" : "")
                }
                onClick={() => setActiveSource(source.id)}
              >
                <source.Icon />
                <span>{source.label}</span>
              </button>
            ))}
          </div>

          <div className="lv2-playground-main">
            <div className="lv2-playground-journey">
              {campaign.journey.map((step, index) => {
                const Icon = journeyIcons[step] || FiLink;
                return (
                  <div key={step} className="lv2-journey-item">
                    <div className="lv2-journey-node">
                      <Icon />
                    </div>
                    <span className="lv2-journey-label">{step}</span>
                    {index < campaign.journey.length - 1 && (
                      <div className="lv2-journey-arrow">
                        <FiArrowRight />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="lv2-playground-panel">
              <div className="lv2-panel-header">
                <span className="lv2-panel-eyebrow">Demonstração</span>
                <strong>Dados exemplificativos</strong>
              </div>
              <div className="lv2-panel-body">
                <div className="lv2-panel-row">
                  <span>Origem detectada</span>
                  <strong>{campaign.source}</strong>
                </div>
                <div className="lv2-panel-row">
                  <span>Canal</span>
                  <strong>{campaign.channel}</strong>
                </div>
                <div className="lv2-panel-row">
                  <span>Campanha</span>
                  <strong>{campaign.campaign}</strong>
                </div>
                {"utm" in campaign && campaign.utm ? (
                  <div className="lv2-panel-utm">
                    <span>UTM</span>
                    <code>
                      {campaign.utm.source}
                      <br />
                      {campaign.utm.medium}
                      <br />
                      {campaign.utm.campaign}
                    </code>
                  </div>
                ) : null}
                {"conversion" in campaign && campaign.conversion ? (
                  <div className="lv2-panel-row">
                    <span>Conversão</span>
                    <strong>{campaign.conversion}</strong>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="lv2-playground-metrics">
            <div className="lv2-metric">
              <span>Visitantes</span>
              <strong>{demoPlaygroundMetrics.visitors}</strong>
            </div>
            <div className="lv2-metric">
              <span>Cliques</span>
              <strong>{demoPlaygroundMetrics.clicks}</strong>
            </div>
            <div className="lv2-metric">
              <span>Conversões</span>
              <strong>{demoPlaygroundMetrics.conversions}</strong>
            </div>
            <span className="lv2-metric-note">Dados demonstrativos</span>
          </div>
        </div>
      </div>
    </section>
  );
}

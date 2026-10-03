"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  FaInstagram,
  FaQrcode,
  FaGoogle,
  FaWhatsapp,
  FaLinkedinIn,
} from "react-icons/fa6";
import { FiArrowRight, FiLink, FiMail, FiUser } from "react-icons/fi";

const sources = [
  { id: "instagram", label: "Instagram", Icon: FaInstagram },
  { id: "qr", label: "QR Code", Icon: FaQrcode },
  { id: "google", label: "Google", Icon: FaGoogle },
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp },
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedinIn },
] as const;

const journeySteps = [
  { id: "source", label: "Origem", Icon: FiUser },
  { id: "page", label: "Smart Page", Icon: FiLink },
  { id: "action", label: "Ação", Icon: FiMail },
  { id: "result", label: "Resultado", Icon: FiUser },
] as const;

export function HeroSection() {
  const [activeSource, setActiveSource] = useState<string | null>(null);
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section className="lv2-hero" ref={sectionRef}>
      <div className="lv2-hero-shell">
        <div className="lv2-hero-copy">
          <span className="lv2-eyebrow">Presença digital + Analytics</span>
          <h1 className="lv2-hero-title">
            Um link é só o{" "}
            <span className="lv2-hero-highlight">começo.</span>
          </h1>
          <p className="lv2-hero-subtitle">
            Descubra de onde vêm seus acessos e o que eles fazem depois.
          </p>
          <p className="lv2-hero-description">
            Crie Smart Pages, Smart Cards, links e QR Codes. Distribua suas
            campanhas e acompanhe cliques, contatos e conversões em um só lugar.
          </p>
          <div className="lv2-hero-actions">
            <Link
              href="/cadastro?next=/conta"
              className="lv2-btn lv2-btn-primary"
            >
              Começar grátis
            </Link>
            <Link href="#playground" className="lv2-btn lv2-btn-ghost">
              Ver como funciona <FiArrowRight />
            </Link>
          </div>
          <span className="lv2-hero-note">Sem cartão de crédito</span>
        </div>

          <div className="lv2-hero-visual" aria-hidden="true">
            <div className="lv2-hero-journey">
            <div className="lv2-hero-sources">
              {sources.map((source) => (
                <button
                  key={source.id}
                  type="button"
                  className={`lv2-hero-source ${
                    activeSource === source.id ? "lv2-hero-source--active" : ""
                  }`}
                  onClick={() =>
                    setActiveSource(
                      activeSource === source.id ? null : source.id,
                    )
                  }
                  aria-pressed={activeSource === source.id}
                >
                  <source.Icon />
                  <span>{source.label}</span>
                </button>
              ))}
            </div>

            <div className="lv2-hero-connector">
              <div className="lv2-hero-line" />
              <div className="lv2-hero-node lv2-hero-node--center">
                <BrandLogo size="sm" tone="dark" />
              </div>
            </div>

            <div className="lv2-hero-destination">
              <div className="lv2-hero-card">
                <div className="lv2-hero-card-avatar" />
                <div className="lv2-hero-card-lines">
                  <div className="lv2-hero-card-line lv2-hero-card-line--title" />
                  <div className="lv2-hero-card-line lv2-hero-card-line--bio" />
                </div>
                <div className="lv2-hero-card-cta">Fale no WhatsApp</div>
              </div>
              <div className="lv2-hero-results">
                {journeySteps.map((step, index) => (
                  <div
                    key={step.id}
                    className={`lv2-hero-result ${activeSource ? "lv2-hero-result--visible" : ""}`}
                    style={{ transitionDelay: `${index * 120}ms` }}
                  >
                    <div className="lv2-hero-result-icon">
                      <step.Icon />
                    </div>
                    <span>{step.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

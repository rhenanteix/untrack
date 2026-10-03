"use client";

import Link from "next/link";
import { FaQrcode } from "react-icons/fa6";
import { FiLink } from "react-icons/fi";

export function SmartCardShowcase() {
  return (
    <section className="lv2-smart-card">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Smart Card</span>
          <h2 className="lv2-section-title">
            Seu cartão profissional sempre com você.
          </h2>
          <p className="lv2-section-description">
            Compartilhe seu cartão digital por QR Code, link ou wallets.
          </p>
        </div>

        <div className="lv2-smart-card-layout">
          <div className="lv2-smart-card-preview">
            <div className="lv2-smart-card">
              <div className="lv2-smart-card-header">
                <div className="lv2-smart-card-avatar" />
                <div>
                  <strong>Rhenan Teixeira</strong>
                  <span>Software / Technology</span>
                </div>
              </div>
              <div className="lv2-smart-card-links">
                <span>linkor...</span>
                <span>@rhenan</span>
              </div>
              <div className="lv2-smart-card-qr">
                <FaQrcode />
              </div>
            </div>
          </div>

          <div className="lv2-smart-card-features">
            <div className="lv2-smart-card-feature">
              <FiLink />
              <div>
                <strong>Link direto</strong>
                <span>Compartilhe em qualquer lugar.</span>
              </div>
            </div>
            <div className="lv2-smart-card-feature">
              <FaQrcode />
              <div>
                <strong>QR Code</strong>
                <span>Para materiais impressos e telas.</span>
              </div>
            </div>
            <div className="lv2-smart-card-feature">
              <FiLink />
              <div>
                <strong>Analytics</strong>
                <span>Acompanhe escaneamentos e cliques.</span>
              </div>
            </div>
          </div>
        </div>

        <div className="lv2-smart-card-actions">
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Começar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

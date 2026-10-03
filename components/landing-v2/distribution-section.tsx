"use client";

import Link from "next/link";
import { FaInstagram, FaLinkedinIn, FaGoogle, FaWhatsapp, FaEnvelope, FaQrcode } from "react-icons/fa6";
import { FiArrowRight } from "react-icons/fi";

const channels = [
  { id: "instagram", label: "Instagram", Icon: FaInstagram },
  { id: "linkedin", label: "LinkedIn", Icon: FaLinkedinIn },
  { id: "google", label: "Google", Icon: FaGoogle },
  { id: "whatsapp", label: "WhatsApp", Icon: FaWhatsapp },
  { id: "email", label: "E-mail", Icon: FaEnvelope },
  { id: "qr", label: "QR", Icon: FaQrcode },
] as const;

export function DistributionSection() {
  return (
    <section className="lv2-distribute">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Distribua</span>
          <h2 className="lv2-section-title">
            Esteja onde seu público está.
          </h2>
          <p className="lv2-section-description">
            Compartilhe em qualquer canal. O LinkOr mantém o contexto da
            jornada.
          </p>
        </div>

        <div className="lv2-distribute-visual">
          <div className="lv2-distribute-channels">
            {channels.map((channel) => (
              <div key={channel.id} className="lv2-distribute-channel">
                <channel.Icon />
                <span>{channel.label}</span>
              </div>
            ))}
          </div>
          <div className="lv2-distribute-arrow">
            <FiArrowRight />
          </div>
          <div className="lv2-distribute-hub">
            <span className="lv2-distribute-hub-label">LinkOr</span>
            <div className="lv2-distribute-hub-items">
              <span>Smart Page</span>
              <span>Smart Card</span>
              <span>Campaign</span>
            </div>
          </div>
        </div>

        <div className="lv2-distribute-actions">
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Começar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

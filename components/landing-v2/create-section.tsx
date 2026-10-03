"use client";

import Link from "next/link";
import { FaQrcode } from "react-icons/fa6";
import { FiLink, FiFileText, FiImage } from "react-icons/fi";

const creations = [
  {
    id: "smart-page",
    title: "Smart Page",
    description: "Página personalizada para reunir seus links e conteúdos.",
    Icon: FiFileText,
  },
  {
    id: "smart-card",
    title: "Smart Card",
    description: "Cartão digital profissional sempre atualizado.",
    Icon: FiImage,
  },
  {
    id: "links",
    title: "Links",
    description: "Links curtos, organizados e rastreáveis.",
    Icon: FiLink,
  },
  {
    id: "qr",
    title: "QR Code",
    description: "QR Codes rastreáveis para qualquer canal.",
    Icon: FaQrcode,
  },
] as const;

export function CreateSection() {
  return (
    <section className="lv2-create">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Crie</span>
          <h2 className="lv2-section-title">
            Sua presença digital em minutos.
          </h2>
          <p className="lv2-section-description">
            Escolha como você quer aparecer e comece sem precisar construir tudo
            do zero.
          </p>
        </div>

        <div className="lv2-create-grid">
          {creations.map((item) => (
            <article key={item.id} className="lv2-create-card">
              <div className="lv2-create-card-icon">
                <item.Icon />
              </div>
              <h3>{item.title}</h3>
              <p>{item.description}</p>
              <Link href="/cadastro?next=/conta" className="lv2-text-link">
                Criar agora
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

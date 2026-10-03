"use client";

import { useState, useCallback } from "react";
import { FaInstagram, FaLinkedinIn, FaWhatsapp, FaYoutube, FaGlobe, FaEnvelope } from "react-icons/fa6";

const defaultBio = {
  name: "Seu Nome",
  title: "Profissão / O que você faz",
  avatar: "",
  links: [
    { label: "Site oficial", url: "https://seusite.com", Icon: FaGlobe },
    { label: "Instagram", url: "https://instagram.com/seuusuario", Icon: FaInstagram },
    { label: "LinkedIn", url: "https://linkedin.com/in/seuusuario", Icon: FaLinkedinIn },
    { label: "WhatsApp", url: "https://wa.me/5511999999999", Icon: FaWhatsapp },
    { label: "YouTube", url: "https://youtube.com/@seuusuario", Icon: FaYoutube },
    { label: "E-mail", url: "mailto:voce@exemplo.com", Icon: FaEnvelope },
  ],
};

export function LinkInBioPreview({ compact = false }: { compact?: boolean }) {
  const [bio, setBio] = useState(defaultBio);

  const updateField = useCallback(
    (field: "name" | "title") =>
    (e: React.ChangeEvent<HTMLInputElement>) =>
      setBio((prev) => ({ ...prev, [field]: e.target.value })),
    [],
  );

  if (compact) {
    return (
      <div className="lv2-bio-preview lv2-bio-preview--compact">
        <div className="lv2-bio-card">
          <div className="lv2-bio-avatar" />
          <strong className="lv2-bio-name">{bio.name}</strong>
          <span className="lv2-bio-title">{bio.title}</span>
          <div className="lv2-bio-links">
            {bio.links.slice(0, 4).map((link) => (
              <div key={link.label} className="lv2-bio-link">
                <link.Icon />
                <span>{link.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lv2-bio-preview">
      <div className="lv2-bio-layout">
        <div className="lv2-bio-form">
          <div className="lv2-bio-field">
            <label htmlFor="bio-name">Nome</label>
            <input
              id="bio-name"
              type="text"
              value={bio.name}
              onChange={updateField("name")}
            />
          </div>
          <div className="lv2-bio-field">
            <label htmlFor="bio-title">Título</label>
            <input
              id="bio-title"
              type="text"
              value={bio.title}
              onChange={updateField("title")}
            />
          </div>
          <p className="lv2-bio-hint">
            Edite os campos e veja o preview atualizar em tempo real.
          </p>
        </div>

        <div className="lv2-bio-mock">
          <div className="lv2-bio-phone">
            <div className="lv2-bio-card">
              <div className="lv2-bio-avatar" />
              <strong className="lv2-bio-name">{bio.name}</strong>
              <span className="lv2-bio-title">{bio.title}</span>
              <div className="lv2-bio-links">
                {bio.links.map((link) => (
                  <div key={link.label} className="lv2-bio-link">
                    <link.Icon />
                    <span>{link.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

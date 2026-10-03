"use client";

import { useState, useCallback } from "react";
import Link from "next/link";

const defaultValues = {
  name: "Seu nome",
  title: "Sua profissão",
  instagram: "@seuusuario",
  website: "seuwebsite.com",
};

export function MiniPageBuilder() {
  const [values, setValues] = useState(defaultValues);

  const update = useCallback(
    (field: keyof typeof defaultValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((prev) => ({ ...prev, [field]: e.target.value }));
    },
    [],
  );

  return (
    <section className="lv2-builder">
      <div className="lv2-shell">
        <div className="lv2-section-heading">
          <span className="lv2-eyebrow">Crie o seu agora</span>
          <h2 className="lv2-section-title">
            Experimente criar sua Smart Page.
          </h2>
          <p className="lv2-section-description">
            Preencha os campos e veja o preview atualizar em tempo real.
          </p>
        </div>

        <div className="lv2-builder-layout">
          <div className="lv2-builder-form">
            <div className="lv2-builder-field">
              <label htmlFor="builder-name">Seu nome</label>
              <input
                id="builder-name"
                type="text"
                value={values.name}
                onChange={update("name")}
                placeholder="Seu nome"
              />
            </div>
            <div className="lv2-builder-field">
              <label htmlFor="builder-title">Seu título</label>
              <input
                id="builder-title"
                type="text"
                value={values.title}
                onChange={update("title")}
                placeholder="Sua profissão"
              />
            </div>
            <div className="lv2-builder-field">
              <label htmlFor="builder-instagram">Instagram</label>
              <input
                id="builder-instagram"
                type="text"
                value={values.instagram}
                onChange={update("instagram")}
                placeholder="@seuusuario"
              />
            </div>
            <div className="lv2-builder-field">
              <label htmlFor="builder-website">Website</label>
              <input
                id="builder-website"
                type="text"
                value={values.website}
                onChange={update("website")}
                placeholder="seuwebsite.com"
              />
            </div>
          </div>

          <div className="lv2-builder-preview">
            <div className="lv2-preview-page">
              <div className="lv2-preview-avatar" />
              <strong className="lv2-preview-name">{values.name}</strong>
              <span className="lv2-preview-title">{values.title}</span>
              <div className="lv2-preview-links">
                <span>@{values.instagram.replace("@", "")}</span>
                <span>{values.website}</span>
              </div>
              <div className="lv2-preview-cta">Fale no WhatsApp</div>
            </div>
          </div>
        </div>

        <div className="lv2-builder-footer">
          <p>Gostou?</p>
          <Link href="/cadastro?next=/conta" className="lv2-btn lv2-btn-primary">
            Continuar e criar grátis
          </Link>
        </div>
      </div>
    </section>
  );
}

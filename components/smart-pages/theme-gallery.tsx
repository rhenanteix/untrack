"use client";
import { useState } from "react";
import { themes, type SmartPageTheme } from "@/modules/smart-pages/themes";
import { PageDesign } from "./page-design";
import styles from "./gallery.module.css";
export function ThemeGallery({
  value,
  onChange,
  disabled,
}: {
  value: SmartPageTheme;
  onChange: (theme: SmartPageTheme) => void;
  disabled: boolean;
}) {
  const [category, setCategory] = useState("Todos");
  return (
    <section className={styles.gallery} aria-label="Modelos de página">
      <div className={styles.heading}>
        <span>IDENTIDADE VISUAL</span>
        <h3>Uma página com a sua cara.</h3>
        <p>Escolha um ponto de partida. Seus textos e links são preservados.</p>
      </div>
      <div className={styles.filters} aria-label="Categorias de modelos">
        {["Todos", ...new Set(themes.map((t) => t.category))].map((c) => (
          <button
            type="button"
            key={c}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      <div className={styles.grid}>
        {themes
          .filter((t) => category === "Todos" || t.category === category)
          .map((t) => (
            <button
              type="button"
              key={t.id}
              className={styles.card}
              aria-pressed={value.preset === t.id}
              aria-label={`Usar modelo ${t.name}`}
              disabled={disabled}
              onClick={() => onChange({ preset: t.id })}
            >
              <div className={styles.thumbnail} aria-hidden="true">
                <div className={styles.scaled}>
                  <PageDesign
                    title={t.name}
                    description={t.description}
                    theme={{ preset: t.id }}
                    preview
                  >
                    <span>Conheça meu trabalho</span>
                    <span>Vamos conversar</span>
                    <span>Meus conteúdos</span>
                  </PageDesign>
                </div>
                <span className={styles.badge}>
                  {value.preset === t.id ? "✓ Selecionado" : "Exemplo"}
                </span>
              </div>
              <div className={styles.caption}>
                <strong>{t.name}</strong>
                <span className={styles.swatches}>
                  {t.colors.map((color) => (
                    <i key={color} style={{ background: color }} />
                  ))}
                </span>
                <small>{t.category}</small>
              </div>
            </button>
          ))}
      </div>
      <p className={styles.hint}>
        Selecione um modelo e clique em <b>Salvar perfil</b> para aplicar. Em
        páginas publicadas, o visual será atualizado ao salvar.
      </p>
    </section>
  );
}

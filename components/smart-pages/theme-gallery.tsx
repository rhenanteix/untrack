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
  const [search, setSearch] = useState("");
  const filtered = themes.filter(
    (t) =>
      (category === "Todos" || t.category === category) &&
      `${t.name} ${t.category} ${t.description}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .includes(
          search
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase(),
        ),
  );
  return (
    <section className={styles.gallery} aria-label="Modelos de página">
      <div className={styles.heading}>
        <span>IDENTIDADE VISUAL</span>
        <h3>Seu próximo capítulo começa aqui.</h3>
        <p>
          Do currículo à sua próxima criação. Explore {themes.length} modelos e
          encontre o seu estilo.
        </p>
        <label className={styles.search}>
          Buscar modelos
          <input
            type="search"
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Currículo, portfólio, música…"
          />
        </label>
      </div>
      <div className={styles.filters} aria-label="Categorias de modelos">
        {["Todos", ...new Set(themes.map((t) => t.category))].map((c) => (
          <button
            type="button"
            key={c}
            aria-pressed={c === category}
            onClick={() => setCategory(c)}
          >
            {c}{" "}
            <small>
              {c === "Todos"
                ? themes.length
                : themes.filter((t) => t.category === c).length}
            </small>
          </button>
        ))}
      </div>
      <p className={styles.resultCount} role="status">
        {filtered.length} modelos encontrados · exemplos ilustrativos
      </p>
      <div className={styles.grid}>
        {filtered.map((t) => (
          <button
            type="button"
            key={t.id}
            className={styles.card}
            aria-pressed={value.preset === t.id}
            aria-label={`Usar modelo ${t.name}`}
            disabled={disabled}
            onClick={() => onChange({ preset: t.id })}
          >
            <div
              className={styles.thumbnail}
              aria-hidden="true"
              style={{ background: t.colors[0] }}
            >
              <div className={styles.scaled}>
                <PageDesign
                  title={t.sample?.name ?? t.name}
                  description={t.sample?.bio ?? t.description}
                  theme={{ preset: t.id }}
                  preview
                >
                  {(
                    t.sample?.links ?? [
                      "Conheça meu trabalho",
                      "Vamos conversar",
                      "Meus conteúdos",
                    ]
                  ).map((label) => (
                    <span key={label}>{label}</span>
                  ))}
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
      {!filtered.length && (
        <div className={styles.empty}>
          <strong>Nenhum modelo encontrado</strong>
          <p>Tente outro termo ou explore todas as categorias.</p>
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setCategory("Todos");
            }}
          >
            Limpar filtros
          </button>
        </div>
      )}
      {["Currículos", "Portfólios"].includes(category) && (
        <aside className={styles.tip}>
          <strong>
            Sua apresentação profissional, pronta para compartilhar
          </strong>
          <p>
            Use a descrição para sua área de atuação e resumo profissional. Na
            etapa Links, adicione seu LinkedIn, currículo em PDF hospedado,
            GitHub ou projetos. Compartilhe o endereço da página em candidaturas
            e no seu perfil.
          </p>
        </aside>
      )}
      <p className={styles.hint}>
        Selecione um modelo e clique em <b>Salvar perfil</b> para aplicar. Em
        páginas publicadas, o visual será atualizado ao salvar.
      </p>
    </section>
  );
}

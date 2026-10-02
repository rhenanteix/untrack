"use client";
import { useState } from "react";
import {
  HiOutlineAdjustmentsHorizontal,
  HiOutlineArrowLeft,
  HiOutlinePhoto,
  HiOutlineRectangleGroup,
  HiOutlineSwatch,
  HiOutlineUserGroup,
  HiOutlineViewColumns,
} from "react-icons/hi2";
import { themes, type SmartPageTheme } from "@/modules/smart-pages/themes";
import { ImageUpload } from "./image-upload";

const photoLayouts = [
  ["classic", "Clássico"],
  ["hero", "Hero"],
  ["banner", "Banner"],
  ["cutout", "Recorte"],
  ["shape", "Forma"],
] as const;

const titleStyles = [
  ["classic", "Clássico"],
  ["editorial", "Editorial"],
  ["bold", "Impacto"],
  ["uppercase", "Maiúsculas"],
] as const;

const wallpaperOptions = [
  ["fill", "Fill"],
  ["gradient", "Gradient"],
  ["blur", "Blur"],
  ["pattern", "Pattern"],
  ["image", "Image"],
  ["video", "Video"],
] as const;

const gradients = [
  ["aurora", "Aurora"],
  ["sunset", "Sol"],
  ["ocean", "Mar"],
  ["orchid", "Orquídea"],
] as const;

const patterns = [
  ["dots", "Pontos"],
  ["grid", "Grade"],
  ["lines", "Linhas"],
  ["waves", "Ondas"],
] as const;

const names = {
  avatar: "Foto",
  title: "Nome",
  description: "Apresentação",
  links: "Links",
  socials: "Redes sociais",
};

const appearanceCategories = [
  {
    id: "colors",
    label: "Cores",
    description: "Fundo, texto e destaque",
    Icon: HiOutlineSwatch,
  },
  {
    id: "typography",
    label: "Tipografia",
    description: "Fonte, estilo e tamanho",
    Icon: HiOutlineAdjustmentsHorizontal,
  },
  {
    id: "buttons",
    label: "Botões",
    description: "Estilo, cantos e ritmo",
    Icon: HiOutlineRectangleGroup,
  },
  {
    id: "socials",
    label: "Redes sociais",
    description: "Ícones, formato e presença",
    Icon: HiOutlineUserGroup,
  },
  {
    id: "background",
    label: "Fundo",
    description: "Cor, imagem ou movimento",
    Icon: HiOutlineViewColumns,
  },
  {
    id: "photo",
    label: "Foto e logo",
    description: "Presença visual do perfil",
    Icon: HiOutlinePhoto,
  },
  {
    id: "layout",
    label: "Layout",
    description: "Alinhamento e seções",
    Icon: HiOutlineViewColumns,
  },
] as const;

type AppearanceCategory = (typeof appearanceCategories)[number]["id"];

const fontOptions: { value: NonNullable<SmartPageTheme["font"]>; label: string }[] = [
  { value: "manrope", label: "Manrope" },
  { value: "sans", label: "Sans serif" },
  { value: "georgia", label: "Georgia" },
  { value: "serif", label: "Serif" },
  { value: "courier", label: "Courier New" },
  { value: "mono", label: "Monospace" },
];

export function AppearanceControls({
  theme,
  onChange,
  disabled,
  pageId,
}: {
  theme: SmartPageTheme;
  onChange: (value: SmartPageTheme) => void;
  disabled: boolean;
  pageId: string;
}) {
  const [activeCategory, setActiveCategory] =
    useState<AppearanceCategory | null>(null);
  const colors = themes.find((item) => item.id === theme.preset)?.colors ?? themes[0].colors;
  const order = theme.sections ?? [
    "avatar",
    "title",
    "description",
    "links",
    "socials",
  ];
  function change(patch: Partial<SmartPageTheme>) {
    onChange({ ...theme, ...patch });
  }

  function changeSectionVisibility(
    section: "avatar" | "description" | "socials",
    visible: boolean,
  ) {
    change({
      hiddenSections: visible
        ? theme.hiddenSections?.filter((item) => item !== section)
        : [...(theme.hiddenSections ?? []), section],
    });
  }

  function moveSection(sectionIndex: number, direction: -1 | 1) {
    const next = [...order];
    [next[sectionIndex], next[sectionIndex + direction]] = [
      next[sectionIndex + direction],
      next[sectionIndex],
    ];
    change({ sections: next });
  }

  function renderCategory() {
    if (activeCategory === "colors") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Cores</span>
            <p>Defina o contraste principal da sua página.</p>
          </div>
          <div className="sp-control-grid">
            {(
              [
                ["background", "Cor de fundo", colors[0]],
                ["textColor", "Texto", colors[1]],
                ["buttonColor", "Cor principal", colors[1]],
              ] as const
            ).map(([key, label, fallback]) => (
              <label key={key}>
                {label}
                <input
                  type="color"
                  value={theme[key] ?? fallback}
                  onChange={(event) => change({ [key]: event.target.value })}
                />
              </label>
            ))}
          </div>
        </>
      );
    }

    if (activeCategory === "typography") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Tipografia</span>
            <p>Escolha uma voz para o nome da sua página.</p>
          </div>
          <div className="sp-font-options" role="group" aria-label="Fonte do título">
            {fontOptions.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                aria-pressed={(theme.font ?? "manrope") === value}
                data-font={value}
                onClick={() => change({ font: value })}
              >
                <b>Aa</b>
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="sp-visual-field">
            <span>Estilo do título</span>
            <div className="sp-title-options" role="group" aria-label="Estilo do título">
              {titleStyles.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.titleStyle ?? "classic") === value}
                  data-title-style={value}
                  onClick={() => change({ titleStyle: value })}
                >
                  <b>Aa</b>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="sp-range-field">
            <span>Tamanho do nome: {theme.titleSize ?? 32}px</span>
            <input
              type="range"
              min="24"
              max="48"
              value={theme.titleSize ?? 32}
              onChange={(event) => change({ titleSize: Number(event.target.value) })}
            />
          </label>
        </>
      );
    }

    if (activeCategory === "buttons") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Botões</span>
            <p>Controle a presença das ações mais importantes.</p>
          </div>
          <div className="sp-segmented-control" role="group" aria-label="Estilo dos botões">
            {(
              [
                ["solid", "Sólido"],
                ["outline", "Contorno"],
                ["soft", "Suave"],
              ] as const
            ).map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={(theme.buttonStyle ?? "solid") === value}
                onClick={() => change({ buttonStyle: value })}
              >
                {label}
              </button>
            ))}
          </div>
          <label className="sp-range-field">
            <span>Formato: {theme.buttonRadius ?? 12}px</span>
            <input
              type="range"
              min="0"
              max="28"
              value={theme.buttonRadius ?? 12}
              onChange={(event) => change({ buttonRadius: Number(event.target.value) })}
            />
          </label>
          <label className="sp-range-field">
            <span>Espaçamento: {theme.spacing ?? 18}px</span>
            <input
              type="range"
              min="8"
              max="32"
              value={theme.spacing ?? 18}
              onChange={(event) => change({ spacing: Number(event.target.value) })}
            />
          </label>
        </>
      );
    }

    if (activeCategory === "socials") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Redes sociais</span>
            <p>Defina como suas conexões aparecem na página pública.</p>
          </div>
          <div className="sp-visual-field">
            <span>Estilo</span>
            <div className="sp-segmented-control" role="group" aria-label="Estilo das redes sociais">
              {(
                [
                  ["icons", "Ícones"],
                  ["icon-text", "Ícone + texto"],
                  ["text", "Texto"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.socialStyle ?? "icons") === value}
                  onClick={() => change({ socialStyle: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-visual-field">
            <span>Formato</span>
            <div className="sp-segmented-control" role="group" aria-label="Formato dos ícones sociais">
              {(
                [
                  ["circle", "Circular"],
                  ["square", "Quadrado"],
                  ["rounded", "Arredondado"],
                  ["minimal", "Minimal"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.socialShape ?? "circle") === value}
                  onClick={() => change({ socialShape: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-visual-field">
            <span>Tamanho</span>
            <div className="sp-segmented-control" role="group" aria-label="Tamanho dos ícones sociais">
              {(
                [
                  ["small", "P"],
                  ["medium", "M"],
                  ["large", "G"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.socialSize ?? "medium") === value}
                  onClick={() => change({ socialSize: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-visual-field">
            <span>Espaçamento</span>
            <div className="sp-segmented-control" role="group" aria-label="Espaçamento das redes sociais">
              {(
                [
                  ["compact", "Compacto"],
                  ["normal", "Normal"],
                  ["wide", "Amplo"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.socialSpacing ?? "normal") === value}
                  onClick={() => change({ socialSpacing: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="sp-visual-field">
            <span>Cor</span>
            <div className="sp-segmented-control" role="group" aria-label="Cor dos ícones sociais">
              {(
                [
                  ["auto", "Automática"],
                  ["theme", "Do tema"],
                  ["brand", "Da marca"],
                  ["custom", "Personalizada"],
                ] as const
              ).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.socialColor ?? "auto") === value}
                  onClick={() => change({ socialColor: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {theme.socialColor === "custom" && (
            <label className="sp-external-media-field">
              Cor personalizada
              <input
                type="color"
                value={theme.socialCustomColor ?? "#183f35"}
                onChange={(event) =>
                  change({ socialCustomColor: event.target.value })
                }
              />
            </label>
          )}
        </>
      );
    }

    if (activeCategory === "background") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Fundo</span>
            <p>Mostramos apenas os controles do fundo escolhido.</p>
          </div>
          <div className="sp-wallpaper-options" role="group" aria-label="Tipo de fundo">
            {wallpaperOptions.map(([value, label]) => (
              <button
                type="button"
                key={value}
                aria-pressed={(theme.wallpaper ?? "fill") === value}
                onClick={() => change({ wallpaper: value })}
              >
                <span className="sp-wallpaper-sample" data-wallpaper={value} aria-hidden="true"><i /></span>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {theme.wallpaper === "gradient" && (
            <div className="sp-mini-options" role="group" aria-label="Gradiente">
              {gradients.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.backgroundGradient ?? "aurora") === value}
                  data-gradient={value}
                  onClick={() => change({ backgroundGradient: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {theme.wallpaper === "pattern" && (
            <div className="sp-mini-options" role="group" aria-label="Padrão de fundo">
              {patterns.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={(theme.backgroundPattern ?? "dots") === value}
                  data-pattern={value}
                  onClick={() => change({ backgroundPattern: value })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {["image", "blur"].includes(theme.wallpaper ?? "fill") && (
            <div className="sp-wallpaper-media">
              <ImageUpload
                pageId={pageId}
                currentUrl={theme.backgroundImageUrl}
                disabled={disabled}
                label={theme.wallpaper === "blur" ? "Imagem para o fundo desfocado" : "Imagem de fundo"}
                description="Envie uma imagem ou informe uma URL externa."
                onUploaded={(url) => change({ backgroundImageUrl: url })}
              />
              <label>
                Imagem externa
                <input
                  type="url"
                  value={theme.backgroundImageUrl ?? ""}
                  placeholder="https://exemplo.com/fundo.webp"
                  onChange={(event) => change({ backgroundImageUrl: event.target.value || undefined })}
                />
              </label>
            </div>
          )}
          {theme.wallpaper === "video" && (
            <label className="sp-external-media-field">
              Vídeo externo
              <input
                type="url"
                value={theme.backgroundVideoUrl ?? ""}
                placeholder="https://exemplo.com/fundo.mp4"
                onChange={(event) => change({ backgroundVideoUrl: event.target.value || undefined })}
              />
              <small>Use uma URL direta de vídeo MP4 ou WebM.</small>
            </label>
          )}
        </>
      );
    }

    if (activeCategory === "photo") {
      return (
        <>
          <div className="sp-design-heading">
            <span>Foto e logo</span>
            <p>Defina como a sua marca aparece no topo.</p>
          </div>
          <div className="sp-visual-field">
            <span>Layout da foto</span>
            <div className="sp-visual-options" role="group" aria-label="Layout da foto">
              {photoLayouts.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  className="sp-visual-choice"
                  aria-pressed={(theme.photoLayout ?? "classic") === value}
                  onClick={() => change({ photoLayout: value })}
                >
                  <span className="sp-photo-layout-sample" data-layout={value} aria-hidden="true"><i /></span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="sp-logo-controls">
            <ImageUpload
              pageId={pageId}
              currentUrl={theme.logoUrl}
              disabled={disabled}
              label="Logo da página"
              description="Envie uma marca em JPG, PNG ou WebP."
              onUploaded={(url) => change({ logoUrl: url })}
            />
            <label>
              Logo por URL externa
              <input
                type="url"
                value={theme.logoUrl ?? ""}
                placeholder="https://exemplo.com/logo.png"
                onChange={(event) => change({ logoUrl: event.target.value || undefined })}
              />
            </label>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="sp-design-heading">
          <span>Layout</span>
          <p>Organize a leitura da página sem perder o contexto.</p>
        </div>
        <div className="sp-segmented-control" role="group" aria-label="Alinhamento">
          {(
            [
              ["center", "Centralizado"],
              ["left", "À esquerda"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={(theme.alignment ?? "center") === value}
              onClick={() => change({ alignment: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="sp-segmented-control" role="group" aria-label="Formato da página">
          {(
            [
              ["card", "Cartão"],
              ["full", "Página inteira"],
            ] as const
          ).map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={(theme.layout ?? "card") === value}
              onClick={() => change({ layout: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sp-range-field">
          <span>Tamanho da foto: {theme.avatarSize ?? 88}px</span>
          <input
            type="range"
            min="48"
            max="144"
            value={theme.avatarSize ?? 88}
            onChange={(event) => change({ avatarSize: Number(event.target.value) })}
          />
        </label>
        <ol className="sp-section-order">
          {order.map((section, index) => (
            <li key={section}>
              <strong>{names[section]}</strong>
              {(["avatar", "description", "socials"] as const).includes(section as "avatar" | "description" | "socials") && (
                <label>
                  <input
                    type="checkbox"
                    checked={!theme.hiddenSections?.includes(section as "avatar" | "description" | "socials")}
                    onChange={(event) =>
                      changeSectionVisibility(
                        section as "avatar" | "description" | "socials",
                        event.target.checked,
                      )
                    }
                  />{" "}
                  Mostrar
                </label>
              )}
              {([-1, 1] as const).map((direction) => (
                <button
                  type="button"
                  key={direction}
                  aria-label={`${direction === -1 ? "Subir" : "Descer"} ${names[section]}`}
                  disabled={
                    disabled ||
                    index + direction < 0 ||
                    index + direction >= order.length
                  }
                  onClick={() => moveSection(index, direction)}
                >
                  {direction === -1 ? "↑" : "↓"}
                </button>
              ))}
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <fieldset className="sp-appearance-controls" disabled={disabled}>
      {activeCategory ? (
        <section className="sp-appearance-drawer" aria-labelledby="sp-appearance-category">
          <button
            type="button"
            className="sp-appearance-back"
            onClick={() => setActiveCategory(null)}
          >
            <HiOutlineArrowLeft aria-hidden="true" />
            Personalizar
          </button>
          <div id="sp-appearance-category" className="sp-appearance-category-content">
            {renderCategory()}
          </div>
        </section>
      ) : (
        <>
          <legend>Personalizar</legend>
          <p className="sp-section-intro">
            Abra somente o detalhe que quer ajustar. A prévia acompanha cada mudança.
          </p>
          <div className="sp-appearance-category-list">
            {appearanceCategories.map(({ id, label, description, Icon }) => (
              <button
                type="button"
                key={id}
                onClick={() => setActiveCategory(id)}
              >
                <Icon aria-hidden="true" />
                <span>
                  <strong>{label}</strong>
                  <small>{description}</small>
                </span>
                <span aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        </>
      )}
    </fieldset>
  );
}

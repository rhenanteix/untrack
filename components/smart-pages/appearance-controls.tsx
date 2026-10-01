"use client";
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
  return (
    <fieldset className="sp-appearance-controls" disabled={disabled}>
      <legend>Ajuste cada detalhe</legend>
      <p className="sp-section-intro">
        Veja cada mudança na prévia. Salve quando estiver do seu jeito.
      </p>
      <section className="sp-design-section" aria-labelledby="sp-header-design">
        <div className="sp-design-heading">
          <span>Header</span>
          <p id="sp-header-design">Organize a sua foto, logo, nome e bio.</p>
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
            description="Envie uma marca em JPG, PNG ou WebP. Ela aparecerá acima do perfil."
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
        <div className="sp-control-grid">
          <label>
            Fonte do título
            <select
              value={theme.font ?? "manrope"}
              onChange={(event) => change({ font: event.target.value as SmartPageTheme["font"] })}
            >
              <option value="manrope">Manrope</option>
              <option value="georgia">Georgia</option>
              <option value="courier">Courier New</option>
            </select>
          </label>
          <label>
            Cor do texto
            <input type="color" value={theme.textColor ?? colors[1]} onChange={(event) => change({ textColor: event.target.value })} />
          </label>
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
                <b>Aa</b><span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
      <section className="sp-design-section" aria-labelledby="sp-wallpaper-design">
        <div className="sp-design-heading">
          <span>Wallpaper</span>
          <p id="sp-wallpaper-design">Crie um fundo próprio ou use mídia da sua marca.</p>
        </div>
        <div className="sp-wallpaper-options" role="group" aria-label="Tipo de wallpaper">
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
            {gradients.map(([value, label]) => <button type="button" key={value} aria-pressed={(theme.backgroundGradient ?? "aurora") === value} data-gradient={value} onClick={() => change({ backgroundGradient: value })}>{label}</button>)}
          </div>
        )}
        {theme.wallpaper === "pattern" && (
          <div className="sp-mini-options" role="group" aria-label="Padrão de fundo">
            {patterns.map(([value, label]) => <button type="button" key={value} aria-pressed={(theme.backgroundPattern ?? "dots") === value} data-pattern={value} onClick={() => change({ backgroundPattern: value })}>{label}</button>)}
          </div>
        )}
        {["image", "blur"].includes(theme.wallpaper ?? "fill") && (
          <div className="sp-wallpaper-media">
            <ImageUpload
              pageId={pageId}
              currentUrl={theme.backgroundImageUrl}
              disabled={disabled}
              label={theme.wallpaper === "blur" ? "Imagem para o fundo desfocado" : "Imagem de fundo"}
              description="Use uma imagem da sua biblioteca ou uma URL externa abaixo."
              onUploaded={(url) => change({ backgroundImageUrl: url })}
            />
            <label>
              Imagem externa
              <input type="url" value={theme.backgroundImageUrl ?? ""} placeholder="https://exemplo.com/wallpaper.webp" onChange={(event) => change({ backgroundImageUrl: event.target.value || undefined })} />
            </label>
          </div>
        )}
        {theme.wallpaper === "video" && (
          <label className="sp-external-media-field">
            Vídeo externo
            <input type="url" value={theme.backgroundVideoUrl ?? ""} placeholder="https://exemplo.com/wallpaper.mp4" onChange={(event) => change({ backgroundVideoUrl: event.target.value || undefined })} />
            <small>Use uma URL direta de vídeo MP4 ou WebM. O vídeo é reproduzido sem áudio e em loop.</small>
          </label>
        )}
      </section>
      <section className="sp-design-section" aria-labelledby="sp-colors-design">
        <div className="sp-design-heading">
          <span>Botões e cores</span>
          <p id="sp-colors-design">Ajuste contraste, formato e ritmo da página.</p>
        </div>
        <div className="sp-control-grid">
        {(
          [
            ["background", "Fundo", colors[0]],
            ["buttonColor", "Botões", colors[1]],
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
        <label>
          Formato
          <select
            value={theme.layout ?? "card"}
            onChange={(event) =>
              change({ layout: event.target.value as SmartPageTheme["layout"] })
            }
          >
            <option value="card">Cartão</option>
            <option value="full">Página inteira</option>
          </select>
        </label>
        <label>
          Alinhamento
          <select
            value={theme.alignment ?? "center"}
            onChange={(event) =>
              change({
                alignment: event.target.value as SmartPageTheme["alignment"],
              })
            }
          >
            <option value="center">Centralizado</option>
            <option value="left">À esquerda</option>
          </select>
        </label>
        <label>
          Estilo dos botões
          <select
            value={theme.buttonStyle ?? "solid"}
            onChange={(event) =>
              change({
                buttonStyle: event.target.value as SmartPageTheme["buttonStyle"],
              })
            }
          >
            <option value="solid">Preenchidos</option>
            <option value="outline">Contorno</option>
            <option value="soft">Suaves</option>
          </select>
        </label>
        <label>
          Cantos dos botões: {theme.buttonRadius ?? 12}px
          <input
            type="range"
            min="0"
            max="28"
            value={theme.buttonRadius ?? 12}
            onChange={(event) => change({ buttonRadius: Number(event.target.value) })}
          />
        </label>
        <label>
          Tamanho da foto: {theme.avatarSize ?? 88}px
          <input
            type="range"
            min="48"
            max="144"
            value={theme.avatarSize ?? 88}
            onChange={(event) => change({ avatarSize: Number(event.target.value) })}
          />
        </label>
        <label>
          Tamanho do nome: {theme.titleSize ?? 32}px
          <input
            type="range"
            min="24"
            max="48"
            value={theme.titleSize ?? 32}
            onChange={(event) => change({ titleSize: Number(event.target.value) })}
          />
        </label>
        <label>
          Espaçamento: {theme.spacing ?? 18}px
          <input
            type="range"
            min="8"
            max="32"
            value={theme.spacing ?? 18}
            onChange={(event) => change({ spacing: Number(event.target.value) })}
          />
        </label>
      </div>
      </section>
      <h4>Ordem e visibilidade</h4>
      <ol className="sp-section-order">
        {order.map((section, index) => (
          <li key={section}>
            <strong>{names[section]}</strong>
            {(["avatar", "description", "socials"] as string[]).includes(
              section,
            ) && (
              <label>
                <input
                  type="checkbox"
                  checked={
                    !theme.hiddenSections?.includes(
                      section as "avatar" | "description" | "socials",
                    )
                  }
                  onChange={(e) =>
                    change({
                      hiddenSections: e.target.checked
                        ? theme.hiddenSections?.filter((s) => s !== section)
                        : [
                            ...(theme.hiddenSections ?? []),
                            section as "avatar" | "description" | "socials",
                          ],
                    })
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
                onClick={() => {
                  const next = [...order];
                  [next[index], next[index + direction]] = [
                    next[index + direction],
                    next[index],
                  ];
                  change({ sections: next });
                }}
              >
                {direction === -1 ? "↑" : "↓"}
              </button>
            ))}
          </li>
        ))}
      </ol>
    </fieldset>
  );
}

"use client";
import { themes, type SmartPageTheme } from "@/modules/smart-pages/themes";
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
}: {
  theme: SmartPageTheme;
  onChange: (value: SmartPageTheme) => void;
  disabled: boolean;
}) {
  const colors = themes.find((t) => t.id === theme.preset)!.colors;
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
      <div className="sp-control-grid">
        {(
          [
            ["background", "Fundo", colors[0]],
            ["textColor", "Texto", colors[1]],
            ["buttonColor", "Botões", colors[1]],
          ] as const
        ).map(([key, label, fallback]) => (
          <label key={key}>
            {label}
            <input
              type="color"
              value={theme[key] ?? fallback}
              onChange={(e) => change({ [key]: e.target.value })}
            />
          </label>
        ))}
        <label>
          Formato
          <select
            value={theme.layout ?? "card"}
            onChange={(e) =>
              change({ layout: e.target.value as SmartPageTheme["layout"] })
            }
          >
            <option value="card">Cartão</option>
            <option value="full">Página inteira</option>
          </select>
        </label>
        <label>
          Tipografia
          <select
            value={theme.font ?? "manrope"}
            onChange={(e) =>
              change({ font: e.target.value as SmartPageTheme["font"] })
            }
          >
            <option value="manrope">Manrope</option>
            <option value="georgia">Georgia</option>
            <option value="courier">Courier New</option>
          </select>
        </label>
        <label>
          Alinhamento
          <select
            value={theme.alignment ?? "center"}
            onChange={(e) =>
              change({
                alignment: e.target.value as SmartPageTheme["alignment"],
              })
            }
          >
            <option value="center">Centralizado</option>
            <option value="left">À esquerda</option>
          </select>
        </label>
        <label>
          Foto
          <select
            value={theme.avatarShape ?? "circle"}
            onChange={(e) =>
              change({
                avatarShape: e.target.value as SmartPageTheme["avatarShape"],
              })
            }
          >
            <option value="circle">Circular</option>
            <option value="rounded">Arredondada</option>
            <option value="square">Quadrada</option>
          </select>
        </label>
        <label>
          Estilo dos botões
          <select
            value={theme.buttonStyle ?? "solid"}
            onChange={(e) =>
              change({
                buttonStyle: e.target.value as SmartPageTheme["buttonStyle"],
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
            onChange={(e) => change({ buttonRadius: Number(e.target.value) })}
          />
        </label>
        <label>
          Tamanho da foto: {theme.avatarSize ?? 88}px
          <input
            type="range"
            min="48"
            max="144"
            value={theme.avatarSize ?? 88}
            onChange={(e) => change({ avatarSize: Number(e.target.value) })}
          />
        </label>
        <label>
          Tamanho do nome: {theme.titleSize ?? 32}px
          <input
            type="range"
            min="24"
            max="48"
            value={theme.titleSize ?? 32}
            onChange={(e) => change({ titleSize: Number(e.target.value) })}
          />
        </label>
        <label>
          Espaçamento: {theme.spacing ?? 18}px
          <input
            type="range"
            min="8"
            max="32"
            value={theme.spacing ?? 18}
            onChange={(e) => change({ spacing: Number(e.target.value) })}
          />
        </label>
      </div>
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

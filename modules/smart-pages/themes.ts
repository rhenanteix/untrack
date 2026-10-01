/** Stable identifiers: persisted in SmartPage.theme, never rename published presets. */
export const themeIds = [
  "minimal",
  "creator",
  "business",
  "dark",
  "editorial",
  "bold",
  "bloom",
  "ocean",
  "cafe",
] as const;
export type ThemePreset = (typeof themeIds)[number];
export type SmartPageTheme = {
  preset: ThemePreset;
  background?: string;
  textColor?: string;
  buttonColor?: string;
  buttonRadius?: number;
};
export const themes: {
  id: ThemePreset;
  name: string;
  category: string;
  description: string;
  colors: string[];
}[] = [
  {
    id: "minimal",
    name: "Studio",
    category: "Essenciais",
    description: "Clareza, espaço e uma presença que fala por si.",
    colors: ["#f6f5f0", "#252921", "#dadcd3"],
  },
  {
    id: "creator",
    name: "Aura",
    category: "Criadores",
    description: "Gradientes suaves para ideias que merecem aparecer.",
    colors: ["#ede7fa", "#523379", "#f6cfc2"],
  },
  {
    id: "business",
    name: "Forma",
    category: "Negócios",
    description: "Verde profundo e precisão para sua marca.",
    colors: ["#e7eee8", "#183f35", "#bcccb7"],
  },
  {
    id: "dark",
    name: "After Hours",
    category: "Criadores",
    description: "Uma presença noturna, com detalhes em lima.",
    colors: ["#171b20", "#dcf5a4", "#333b43"],
  },
  {
    id: "editorial",
    name: "Atelier",
    category: "Negócios",
    description: "Tipografia editorial e o calor do papel.",
    colors: ["#eee7db", "#552f28", "#b89478"],
  },
  {
    id: "bold",
    name: "Amplifica",
    category: "Criadores",
    description: "Contraste e personalidade sem pedir licença.",
    colors: ["#f5da58", "#29251b", "#fff8db"],
  },
  {
    id: "bloom",
    name: "Botânica",
    category: "Bem-estar",
    description: "Formas orgânicas para uma conexão mais leve.",
    colors: ["#edf0e5", "#435342", "#ccd6b9"],
  },
  {
    id: "ocean",
    name: "Maré",
    category: "Essenciais",
    description: "Azul profundo, luz e movimento em equilíbrio.",
    colors: ["#e5eff6", "#24496c", "#bdcddd"],
  },
  {
    id: "cafe",
    name: "Café",
    category: "Negócios",
    description: "Uma identidade acolhedora, feita para receber.",
    colors: ["#f2e7d7", "#693f2c", "#d3b69a"],
  },
];
export function readableInk(hex: string) {
  const channels = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722 >
    0.179
    ? "#111111"
    : "#ffffff";
}

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
  "resume",
  "executive",
  "developer",
  "folio",
  "gallery",
  "architect",
  "rose",
  "sunset",
  "fitness",
  "music",
  "kitchen",
  "community",
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
  sample?: { name: string; bio: string; links: string[] };
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
    category: "Gastronomia",
    description: "Uma identidade acolhedora, feita para receber.",
    colors: ["#f2e7d7", "#693f2c", "#d3b69a"],
  },
  {
    id: "resume",
    name: "Trajetória",
    category: "Currículos",
    description: "Seu próximo passo começa com uma boa apresentação.",
    colors: ["#f4f6fa", "#203c61", "#ccd7e5"],
    sample: {
      name: "Ana Martins",
      bio: "Gestão de projetos · Operações\nConectando pessoas, processos e resultados.",
      links: [
        "Currículo em PDF",
        "Experiência no LinkedIn",
        "Entre em contato",
      ],
    },
  },
  {
    id: "executive",
    name: "Executivo",
    category: "Currículos",
    description: "Elegância e clareza para consultores e lideranças.",
    colors: ["#eeece5", "#263a33", "#b8a87b"],
    sample: {
      name: "Rafael Costa",
      bio: "Consultoria de negócios\nEstratégia com propósito e direção.",
      links: [
        "Conheça minha trajetória",
        "Perfil no LinkedIn",
        "Agende uma conversa",
      ],
    },
  },
  {
    id: "developer",
    name: "Terminal",
    category: "Currículos",
    description: "Uma identidade técnica para quem constrói o futuro.",
    colors: ["#111d28", "#bde6d5", "#395b68"],
    sample: {
      name: "Alex Santos",
      bio: "Software engineer · Full stack\nTransformando ideias em produtos digitais.",
      links: [
        "Projetos no GitHub",
        "Currículo e experiência",
        "Vamos conversar",
      ],
    },
  },
  {
    id: "folio",
    name: "Forma & Função",
    category: "Portfólios",
    description: "Projetos em primeiro plano, com uma assinatura criativa.",
    colors: ["#f5f0e8", "#ed592f", "#27251f"],
    sample: {
      name: "Marina Lopes",
      bio: "Design de produto & direção de arte\nIdeias que ganham forma.",
      links: [
        "Projetos selecionados",
        "Meu processo criativo",
        "Vamos criar juntos",
      ],
    },
  },
  {
    id: "gallery",
    name: "Galeria",
    category: "Portfólios",
    description: "Um espaço editorial para fotografia e artes visuais.",
    colors: ["#222323", "#eeeae2", "#aeafa6"],
    sample: {
      name: "Lucas Oliveira",
      bio: "Fotografia & histórias visuais\nUm novo olhar para o cotidiano.",
      links: ["Ensaios e coleções", "Portfólio completo", "Reserve uma sessão"],
    },
  },
  {
    id: "architect",
    name: "Perspectiva",
    category: "Portfólios",
    description: "Linhas precisas para arquitetura, interiores e design.",
    colors: ["#ece9e2", "#51473f", "#b8ada0"],
    sample: {
      name: "Estúdio Norte",
      bio: "Arquitetura & interiores\nEspaços para viver com intenção.",
      links: [
        "Projetos residenciais",
        "Conheça o estúdio",
        "Conte sobre seu projeto",
      ],
    },
  },
  {
    id: "rose",
    name: "Rosé",
    category: "Beleza",
    description: "Delicadeza e sofisticação em cada detalhe.",
    colors: ["#f5e7e6", "#713e4b", "#d5acb4"],
  },
  {
    id: "sunset",
    name: "Sol",
    category: "Criadores",
    description: "Cores solares para uma presença cheia de vida.",
    colors: ["#ffdfba", "#782e2b", "#f7a983"],
  },
  {
    id: "fitness",
    name: "Movimento",
    category: "Esporte",
    description: "Energia e contraste para sua rotina e comunidade.",
    colors: ["#e8ff75", "#222b24", "#ffffff"],
  },
  {
    id: "music",
    name: "Frequência",
    category: "Música",
    description: "Um palco digital para lançamentos e conexões.",
    colors: ["#25152c", "#fbc2e7", "#9d78c4"],
  },
  {
    id: "kitchen",
    name: "À Mesa",
    category: "Gastronomia",
    description: "Uma apresentação com sabor de encontro.",
    colors: ["#fff5df", "#9a382e", "#e8c18e"],
  },
  {
    id: "community",
    name: "Conexão",
    category: "Educação",
    description: "Conhecimento e conversas que aproximam.",
    colors: ["#e7ecfa", "#344b87", "#bac8ee"],
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

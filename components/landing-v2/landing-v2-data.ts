export const demoCampaigns = {
  instagram: {
    source: "Instagram",
    channel: "Organic Social",
    campaign: "Lançamento Outubro",
    utm: {
      source: "utm_source=instagram",
      medium: "utm_medium=organic",
      campaign: "utm_campaign=lancamento",
    },
    journey: ["Instagram", "Smart Page", "WhatsApp", "Lead"],
  },
  qr: {
    source: "QR Code",
    channel: "Offline",
    campaign: "Evento 2026",
    conversion: "Formulário enviado",
    journey: ["QR Code", "Smart Page", "Formulário", "Lead"],
  },
  google: {
    source: "Google",
    channel: "Organic Search",
    campaign: "Brand awareness",
    utm: {
      source: "utm_source=google",
      medium: "utm_medium=organic",
      campaign: "utm_campaign=brand",
    },
    journey: ["Google", "Smart Page", "Link", "WhatsApp"],
  },
  whatsapp: {
    source: "WhatsApp",
    channel: "Messaging",
    campaign: "Share",
    journey: ["WhatsApp", "Smart Page", "CTA", "Contato"],
  },
} as const;

export const demoAnalytics = {
  "7d": {
    visitors: 12482,
    clicks: 3721,
    conversions: 483,
    sources: [
      { name: "Instagram", percent: 38 },
      { name: "Google", percent: 27 },
      { name: "QR Code", percent: 19 },
      { name: "WhatsApp", percent: 11 },
      { name: "Outros", percent: 5 },
    ],
  },
  "30d": {
    visitors: 45200,
    clicks: 12800,
    conversions: 1840,
    sources: [
      { name: "Instagram", percent: 35 },
      { name: "Google", percent: 30 },
      { name: "QR Code", percent: 18 },
      { name: "WhatsApp", percent: 12 },
      { name: "Outros", percent: 5 },
    ],
  },
  "90d": {
    visitors: 128000,
    clicks: 38500,
    conversions: 5200,
    sources: [
      { name: "Instagram", percent: 33 },
      { name: "Google", percent: 32 },
      { name: "QR Code", percent: 17 },
      { name: "WhatsApp", percent: 13 },
      { name: "Outros", percent: 5 },
    ],
  },
} as const;

export const demoTemplates = [
  { id: "creator", name: "Creator", description: "Para criadores de conteúdo" },
  { id: "professional", name: "Professional", description: "Perfil profissional" },
  { id: "business", name: "Business", description: "Para pequenos negócios" },
  { id: "restaurant", name: "Restaurant", description: "Cardápio e reservas" },
  { id: "event", name: "Event", description: "Eventos e ingressos" },
  { id: "portfolio", name: "Portfolio", description: "Portfólio criativo" },
  { id: "tourism", name: "Tourism", description: "Guias e experiências" },
] as const;

export const demoUseCases = [
  {
    title: "Creator",
    description:
      "Reúna seus conteúdos, redes e campanhas em uma página e entenda qual canal traz mais engajamento.",
  },
  {
    title: "Profissional",
    description:
      "Apresente seu trabalho, distribua seu cartão digital e saiba de onde vêm seus contatos.",
  },
  {
    title: "Negócio",
    description:
      "Distribua links, QR Codes e campanhas e acompanhe conversões por canal em tempo real.",
  },
  {
    title: "Agência",
    description:
      "Gerencie campanhas de múltiplos clientes, compare resultados e compartilhe relatórios claros.",
  },
] as const;

export const demoPricing = {
  free: {
    name: "Free",
    price: "R$ 0",
    period: "/mês",
    benefits: [
      "1 Smart Page",
      "1 Smart Card",
      "10 links",
      "3 QR Codes",
      "Analytics de 7 dias",
      "1 campanha",
    ],
  },
  premium: {
    name: "Premium",
    price: "R$ 29,90",
    period: "/mês",
    benefits: [
      "10 Smart Pages",
      "5 Smart Cards",
      "100.000 links",
      "100.000 QR Codes",
      "Analytics de 365 dias",
      "100 campanhas",
      "Domínio personalizado",
      "Remoção da marca LinkOr",
      "Exportação de dados",
      "Pixels e tracking avançado",
    ],
  },
} as const;

export const demoAudience = {
  name: "Maria Silva",
  origin: "Instagram",
  campaign: "Lançamento Outubro",
  firstTouch: "Instagram",
  lastTouch: "Smart Page",
  timeline: [
    { time: "10:32", action: "Smart Page visit" },
    { time: "10:34", action: "Link click" },
    { time: "10:36", action: "Form submit" },
    { time: "10:36", action: "Lead created" },
  ],
} as const;

export const demoJourney = {
  steps: [
    { number: "01", title: "Crie", description: "Smart Page, Smart Card, Link ou QR." },
    { number: "02", title: "Distribua", description: "Compartilhe nos seus canais." },
    { number: "03", title: "Entenda", description: "Acompanhe origem e comportamento." },
    { number: "04", title: "Converta", description: "Defina objetivos e acompanhe resultados." },
  ],
} as const;

export const demoPlaygroundMetrics = {
  visitors: "1.284",
  clicks: "347",
  conversions: "61",
} as const;

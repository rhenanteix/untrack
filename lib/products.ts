export const productCategories = [
  {
    id: "links",
    name: "Links",
    description: "Crie, organize e entenda seus links.",
  },
  {
    id: "campaigns",
    name: "Campanhas",
    description: "Organize canais, URLs rastreáveis e resultados.",
  },
  {
    id: "experience",
    name: "Experiência",
    description: "Reúna e distribua o que você quer compartilhar.",
  },
  {
    id: "intelligence",
    name: "Inteligência",
    description: "Transforme acessos em decisões melhores.",
  },
] as const;

export type ProductCategory = (typeof productCategories)[number]["id"];

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  description: string;
  headline: string;
  summary: string;
  toolHref: string;
  ctaLabel: string;
  anonymousUsage: boolean;
  workflow: readonly string[];
  audience: string;
  related: readonly string[];
};

export const products = [
  {
    slug: "short-links",
    name: "Short Links",
    category: "links",
    description: "Crie links curtos e acompanhe seus cliques.",
    headline: "Links curtos. Mais controle.",
    summary:
      "Crie links fáceis de compartilhar e acompanhe o desempenho de cada acesso na sua conta.",
    toolHref: "/encurtar",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["URL longa", "Link curto", "Cliques"],
    audience:
      "Times, criadores e pequenas empresas que compartilham links todos os dias.",
    related: ["utm-builder", "qr-code", "analytics", "campanhas"],
  },
  {
    slug: "whatsapp",
    name: "WhatsApp",
    category: "links",
    description: "Crie links de WhatsApp e acompanhe os cliques.",
    headline: "Transforme seu WhatsApp em um canal mensurável.",
    summary:
      "Crie links para WhatsApp, acompanhe cliques e conecte seus acessos às suas campanhas.",
    toolHref: "/untrack/whatsapp",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["WhatsApp", "Campanha", "UTM", "QR", "Cliques"],
    audience: "Pequenas empresas e equipes que recebem contatos pelo WhatsApp.",
    related: ["campanhas", "utm-builder", "qr-code", "analytics"],
  },
  {
    slug: "link-analyzer",
    name: "Link Analyzer",
    category: "links",
    description: "Descubra o que existe por trás de uma URL.",
    headline: "Entenda um link antes de compartilhar.",
    summary:
      "Analise domínio, parâmetros, redirecionamentos e sinais técnicos de uma URL em um único relatório.",
    toolHref: "/analisar-link",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["URL", "Análise", "Sinais", "Recomendações"],
    audience:
      "Quem precisa revisar URLs de campanhas, parceiros ou conteúdos antes de publicá-las.",
    related: ["link-cleaner", "link-health", "utm-builder", "short-links"],
  },
  {
    slug: "link-cleaner",
    name: "Link Cleaner",
    category: "links",
    description: "Remova parâmetros de tracking sem alterar o destino.",
    headline: "Compartilhe links sem o ruído do tracking.",
    summary:
      "Remova parâmetros de rastreamento conhecidos e preserve os parâmetros necessários para a página funcionar.",
    toolHref: "/limpar-link",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["URL com tracking", "Limpeza", "Link pronto"],
    audience:
      "Pessoas e equipes que querem compartilhar URLs mais claras e confiáveis.",
    related: ["link-analyzer", "link-health", "short-links", "utm-builder"],
  },
  {
    slug: "link-health",
    name: "Link Health",
    category: "links",
    description: "Verifique sinais de saúde técnica dos seus links.",
    headline: "Descubra quando seus links precisam de atenção.",
    summary:
      "Confira HTTPS, resposta HTTP, redirects e outros sinais técnicos com uma pontuação explicável.",
    toolHref: "/link-health",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["URL", "Status", "Redirect", "Sinais"],
    audience:
      "Equipes que dependem de links funcionais em campanhas e materiais públicos.",
    related: ["link-analyzer", "short-links", "campanhas", "analytics"],
  },
  {
    slug: "campanhas",
    name: "Campaigns",
    category: "campaigns",
    description: "Organize links, canais e resultados de campanha.",
    headline: "Todos os canais de uma campanha em um só lugar.",
    summary:
      "Organize iniciativas, canais e ativos para manter a execução de campanhas visível para todo o time.",
    toolHref: "/untrack/campaigns",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["Campanha", "Canais", "Links", "Resultados"],
    audience:
      "Times de marketing e agências que acompanham iniciativas em vários canais.",
    related: ["utm-builder", "qr-code", "analytics", "whatsapp"],
  },
  {
    slug: "utm-builder",
    name: "UTM Builder",
    category: "campaigns",
    description: "Crie URLs rastreáveis de forma consistente.",
    headline: "Crie UTMs sem complicação.",
    summary:
      "Padronize seus links de campanha e mantenha origens, mídias e campanhas organizadas.",
    toolHref: "/gerar-utm",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["Source", "Medium", "Campaign", "URL"],
    audience:
      "Marketing, agências e criadores que precisam comparar a origem dos acessos.",
    related: ["qr-code", "campanhas", "short-links", "analytics"],
  },
  {
    slug: "qr-code",
    name: "QR Code",
    category: "campaigns",
    description: "Crie QR Codes para links e campanhas.",
    headline: "Crie QR Codes que você consegue acompanhar.",
    summary:
      "Gere QR Codes rapidamente e conecte acessos offline aos seus links e campanhas.",
    toolHref: "/gerar-qrcode",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["QR Code", "Scan", "Link", "Cliques"],
    audience:
      "Quem conecta materiais impressos, vitrines e eventos a experiências digitais.",
    related: ["utm-builder", "short-links", "campanhas", "analytics"],
  },
  {
    slug: "smart-pages",
    name: "Smart Pages",
    category: "experience",
    description:
      "Crie páginas para reunir, distribuir e acompanhar seus links.",
    headline: "Uma página para tudo o que você quer compartilhar.",
    summary:
      "Crie uma página personalizada para reunir links, conteúdos, produtos, WhatsApp e campanhas.",
    toolHref: "/untrack/smart-pages",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["Editor", "Blocos", "Publicação", "Cliques"],
    audience:
      "Criadores, negócios e equipes que precisam de um destino único para seus links.",
    related: ["short-links", "whatsapp", "analytics", "campanhas"],
  },
  {
    slug: "analytics",
    name: "Analytics",
    category: "intelligence",
    description: "Entenda cliques, fontes e desempenho em um só lugar.",
    headline: "Saiba o que acontece depois do clique.",
    summary:
      "Acompanhe cliques dos seus links, fontes e desempenho para decidir o que ajustar a seguir.",
    toolHref: "/conta",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["Links", "Cliques", "Fontes", "Desempenho"],
    audience:
      "Pessoas e equipes que precisam transformar acessos em contexto para decisões.",
    related: ["short-links", "qr-code", "campanhas", "smart-pages"],
  },
] as const satisfies readonly Product[];

export function getProduct(slug: string) {
  return products.find((product) => product.slug === slug);
}

export function getProductsByCategory(category: ProductCategory) {
  return products.filter((product) => product.category === category);
}

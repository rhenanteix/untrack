export const productCategories = [
  {
    id: "create-share",
    name: "Criar & compartilhar",
    description: "Coloque seus links para trabalhar.",
  },
  {
    id: "campaigns",
    name: "Campanhas",
    description: "Crie campanhas organizadas e rastreáveis.",
  },
  {
    id: "intelligence",
    name: "Inteligência",
    description: "Descubra o que realmente existe por trás dos seus links.",
  },
  {
    id: "performance",
    name: "Performance",
    description: "Entenda o que acontece depois do clique.",
  },
  {
    id: "operations",
    name: "Operações",
    description: "Tenha controle sobre todos os seus links.",
  },
] as const;

export type ProductCategory = (typeof productCategories)[number]["id"];

export type Product = {
  slug: string;
  name: string;
  category: ProductCategory;
  legacySlugs?: readonly string[];
  description: string;
  headline: string;
  summary: string;
  seoTitle: string;
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
    category: "create-share",
    description: "Crie links curtos e acompanhe seus cliques.",
    headline: "Links curtos. Mais controle.",
    summary:
      "Crie links fáceis de compartilhar e acompanhe o desempenho de cada acesso na sua conta.",
    seoTitle: "Short Links | Links Curtos e Rastreáveis",
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
    category: "create-share",
    description: "Crie links de WhatsApp e acompanhe os cliques.",
    headline: "Transforme seu WhatsApp em um canal mensurável.",
    summary:
      "Crie links para WhatsApp, acompanhe cliques e conecte seus acessos às suas campanhas.",
    seoTitle: "Links para WhatsApp | LinkOr",
    toolHref: "/untrack/whatsapp",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["WhatsApp", "Campanha", "UTM", "QR", "Cliques"],
    audience: "Pequenas empresas e equipes que recebem contatos pelo WhatsApp.",
    related: ["campanhas", "utm-builder", "qr-code", "analytics"],
  },
  {
    slug: "analisar-link",
    legacySlugs: ["link-analyzer"],
    name: "Analisar Link",
    category: "intelligence",
    description: "Descubra o que existe por trás de uma URL.",
    headline: "Entenda um link antes de compartilhar.",
    summary:
      "Analise domínio, parâmetros, redirecionamentos e sinais técnicos de uma URL em um único relatório.",
    seoTitle: "Analisar Link | Link Intelligence",
    toolHref: "/analisar-link",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["URL", "Análise", "Sinais", "Recomendações"],
    audience:
      "Quem precisa revisar URLs de campanhas, parceiros ou conteúdos antes de publicá-las.",
    related: ["link-cleaner", "link-health", "utm-builder", "short-links"],
  },
  {
    slug: "limpar-link",
    legacySlugs: ["link-cleaner"],
    name: "Limpar Link",
    category: "intelligence",
    description: "Remova parâmetros de tracking sem alterar o destino.",
    headline: "Compartilhe links sem o ruído do tracking.",
    summary:
      "Remova parâmetros de rastreamento conhecidos e preserve os parâmetros necessários para a página funcionar.",
    seoTitle: "Limpar Link | URLs Mais Limpas",
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
    category: "intelligence",
    description: "Verifique sinais de saúde técnica dos seus links.",
    headline: "Descubra quando seus links precisam de atenção.",
    summary:
      "Confira HTTPS, resposta HTTP, redirects e outros sinais técnicos com uma pontuação explicável.",
    seoTitle: "Link Health | Saúde Técnica de URLs",
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
    seoTitle: "Campaigns | Organize Links e Campanhas",
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
    seoTitle: "UTM Builder | Crie URLs Rastreáveis",
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
    category: "create-share",
    description: "Crie QR Codes para links e campanhas.",
    headline: "Crie QR Codes que você consegue acompanhar.",
    summary:
      "Gere QR Codes rapidamente e conecte acessos offline aos seus links e campanhas.",
    seoTitle: "QR Code Grátis | LinkOr",
    toolHref: "/gerar-qrcode",
    ctaLabel: "Testar agora",
    anonymousUsage: true,
    workflow: ["QR Code", "Scan", "Link", "Cliques"],
    audience:
      "Quem conecta materiais impressos, vitrines e eventos a experiências digitais.",
    related: ["utm-builder", "short-links", "campanhas", "analytics"],
  },
  {
    slug: "link-in-bio",
    legacySlugs: ["smart-pages"],
    name: "Link in Bio",
    category: "create-share",
    description:
      "Crie páginas para reunir, distribuir e acompanhar seus links.",
    headline: "Uma página para tudo o que você quer compartilhar.",
    summary:
      "Crie uma página personalizada para reunir links, conteúdos, produtos, WhatsApp e campanhas.",
    seoTitle: "Link in Bio | Sua Página para Todos os Seus Links",
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
    category: "performance",
    description: "Entenda cliques, fontes e desempenho em um só lugar.",
    headline: "Saiba o que acontece depois do clique.",
    summary:
      "Acompanhe cliques dos seus links, fontes e desempenho para decidir o que ajustar a seguir.",
    seoTitle: "Analytics de Links e Campanhas | LinkOr",
    toolHref: "/conta",
    ctaLabel: "Começar grátis",
    anonymousUsage: false,
    workflow: ["Links", "Cliques", "Fontes", "Desempenho"],
    audience:
      "Pessoas e equipes que precisam transformar acessos em contexto para decisões.",
    related: ["short-links", "qr-code", "campanhas", "smart-pages"],
  },
  {
    slug: "monitoring",
    name: "Monitoring",
    category: "operations",
    description: "Acompanhe quando links e campanhas precisam de atenção.",
    headline: "Saiba quando seus links precisam de atenção.",
    summary:
      "Acompanhe sinais de saúde, alterações e incidentes das suas campanhas no workspace.",
    seoTitle: "Monitoring de Links | LinkOr",
    toolHref: "/untrack/link-health",
    ctaLabel: "Conhecer Monitoring",
    anonymousUsage: false,
    workflow: ["Links", "Checks", "Sinais", "Ações"],
    audience:
      "Times que precisam acompanhar a saúde de links importantes e agir antes que uma campanha seja afetada.",
    related: ["link-health", "analytics", "campanhas", "short-links"],
  },
] as const satisfies readonly Product[];

export const productMenuCategories = [
  {
    id: "create-share",
    name: "Criar & compartilhar",
    description: "Coloque seus links para trabalhar.",
    productSlugs: ["link-in-bio", "short-links", "qr-code", "whatsapp"],
  },
  {
    id: "campaigns",
    name: "Campanhas",
    description: "Crie campanhas organizadas e rastreáveis.",
    productSlugs: ["campanhas", "utm-builder", "qr-code"],
  },
  {
    id: "intelligence",
    name: "Inteligência",
    description: "Descubra o que realmente existe por trás dos seus links.",
    productSlugs: ["analisar-link", "limpar-link", "link-health"],
  },
  {
    id: "performance",
    name: "Performance",
    description: "Entenda o que acontece depois do clique.",
    productSlugs: ["analytics"],
  },
  {
    id: "operations",
    name: "Operações",
    description: "Tenha controle sobre todos os seus links.",
    productSlugs: ["monitoring"],
  },
] as const;

export const freeToolSlugs = ["qr-code", "utm-builder", "short-links"] as const;

export function getProduct(slug: string) {
  return products.find(
    (product) =>
      product.slug === slug ||
      ("legacySlugs" in product &&
        (product.legacySlugs as readonly string[]).includes(slug)),
  );
}

export function getProductsByCategory(category: ProductCategory) {
  return products.filter((product) => product.category === category);
}

export function getProductsForMenuCategory(
  category: (typeof productMenuCategories)[number],
) {
  return category.productSlugs.flatMap((slug) => {
    const product = getProduct(slug);
    return product ? [product] : [];
  });
}

export function getFreeTools() {
  return freeToolSlugs.flatMap((slug) => {
    const product = getProduct(slug);
    return product ? [product] : [];
  });
}

export function getProductPaths() {
  return products.flatMap((product) => [
    product.slug,
    ...("legacySlugs" in product ? product.legacySlugs : []),
  ]);
}

export const platforms = [
  "WordPress",
  "Shopify",
  "VTEX",
  "Google Tag Manager",
  "Site próprio",
  "Não sei",
] as const;
export const instructions: Record<(typeof platforms)[number], string> = {
  WordPress:
    "Peça ao administrador para inserir o código no cabeçalho pelo tema ou por um gerenciador de scripts. Conecte a categoria Estatísticas do banner ao LinkOr e publique.",
  Shopify:
    "Peça ao responsável pela loja para instalar no tema da vitrine e conectar o consentimento de analytics. Este script não cobre o checkout nem o ambiente isolado de Customer Events. Compras precisam de confirmação pelo servidor.",
  VTEX: "Peça à agência ou ao responsável técnico para incluir o script na vitrine ou no GTM já utilizado pela loja, com o consentimento da CMP. A disponibilidade depende da configuração da loja.",
  "Google Tag Manager":
    "Crie uma tag HTML personalizado com o código abaixo. Configure consentimento adicional obrigatório analytics_storage. Use um evento personalizado linkor_analytics_granted, emitido pela CMP após atualizar o consentimento (também nas visitas com escolha salva). Não use All Pages para autorizar o Pixel. A CMP também deve revogar o consentimento no SDK, sem depender de uma tag bloqueada por consentimento.",
  "Site próprio":
    "Envie o código para quem cuida do site. Inclua uma vez no cabeçalho e conecte as escolhas do banner pelo exemplo de consentimento abaixo.",
  "Não sei":
    "Envie este código e as instruções de consentimento à pessoa ou agência responsável pelo seu site. Não há instalação automática; ela poderá identificar a plataforma e instalar.",
};
export const goalLabels = {
  quote: "Pedido de orçamento",
  whatsapp: "Clique no WhatsApp",
  appointment: "Agendamento",
  registration: "Cadastro",
} as const;
export function installationSnippet(origin: string, siteId: string) {
  const src = new URL("/pixel/v1.js", origin).href;
  // Values are generated internally; encode defensively for HTML embedding.
  const escape = (value: string) =>
    value.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  return `<script async src="${escape(src)}" data-site-id="${escape(siteId)}" referrerpolicy="no-referrer"></script>`;
}
export const consentSnippet = `// No callback da CMP, use "granted" somente após autorização de analytics.
// Execute também para a escolha salva e para revogação ("denied").
window.LinkOrConsent = escolhaAnalytics; // "granted" ou "denied"
window.dispatchEvent(new CustomEvent("linkor:consent", {
  detail: { analytics: window.LinkOrConsent }
}));
// No GTM, após conceder: dataLayer.push({event: "linkor_analytics_granted"});`;

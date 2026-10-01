import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return [
    "",
    "/limpar-link",
    "/gerar-utm",
    "/gerar-qrcode",
    "/encurtar",
    "/link-health",
    "/analisar-link",
    "/produtos",
    "/produtos/short-links",
    "/produtos/whatsapp",
    "/produtos/link-analyzer",
    "/produtos/link-cleaner",
    "/produtos/link-health",
    "/produtos/campanhas",
    "/produtos/utm-builder",
    "/produtos/qr-code",
    "/produtos/smart-pages",
    "/produtos/analytics",
    "/precos",
    "/recursos",
    "/sobre",
    "/blog",
    "/ajuda",
    "/contato",
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.8 : 1,
  }));
}

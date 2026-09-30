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
  ].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? "monthly" : "weekly",
    priority: path ? 0.8 : 1,
  }));
}

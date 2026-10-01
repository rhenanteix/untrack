import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Recursos",
  description: "Recursos da Untrack para criar, analisar e acompanhar links.",
  alternates: { canonical: "/recursos" },
};

export default function ResourcesPage() {
  return (
    <StaticInfoPage
      eyebrow="Recursos"
      title="Trabalhe com links com mais contexto."
      description="Explore ferramentas para criar URLs, organizar campanhas e entender o que acontece depois de compartilhar."
      sections={[
        {
          title: "Analytics",
          description:
            "Acompanhe cliques e desempenho dos seus links no dashboard.",
          href: "/produtos/analytics",
          action: "Conhecer Analytics",
        },
        {
          title: "Link Intelligence",
          description:
            "Revise parâmetros, redirects e sinais técnicos antes de compartilhar uma URL.",
          href: "/produtos/link-analyzer",
          action: "Analisar um link",
        },
        {
          title: "Campanhas",
          description:
            "Organize canais, links e ativos de uma campanha no mesmo espaço de trabalho.",
          href: "/produtos/campanhas",
          action: "Conhecer Campaigns",
        },
      ]}
    />
  );
}

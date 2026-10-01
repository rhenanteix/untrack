import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Blog",
  description: "Ideias e guias práticos sobre links, campanhas e mensuração.",
  alternates: { canonical: "/blog" },
};

export default function BlogPage() {
  return (
    <StaticInfoPage
      eyebrow="Blog"
      title="Guias para trabalhar melhor com links."
      description="Enquanto novas publicações são preparadas, use as ferramentas da plataforma para colocar esses conceitos em prática."
      sections={[
        {
          title: "UTMs consistentes",
          description:
            "Padronize os links de campanha antes de comparar resultados.",
          href: "/gerar-utm",
          action: "Criar uma UTM",
        },
        {
          title: "QR Codes em campanha",
          description:
            "Conecte materiais físicos a links que você pode organizar no seu trabalho.",
          href: "/gerar-qrcode",
          action: "Gerar um QR Code",
        },
        {
          title: "Saúde de links",
          description:
            "Revise sinais técnicos e redirects antes de usar uma URL em uma campanha.",
          href: "/link-health",
          action: "Verificar Link Health",
        },
      ]}
    />
  );
}

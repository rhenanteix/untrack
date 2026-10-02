import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Ajuda",
  description:
    "Encontre a ferramenta LinkOr certa para a sua próxima tarefa com links.",
  alternates: { canonical: "/ajuda" },
};

export default function HelpPage() {
  return (
    <StaticInfoPage
      eyebrow="Ajuda"
      title="Encontre o próximo passo para o seu link."
      description="Comece por uma ferramenta específica ou crie uma conta para reunir seus resultados no dashboard."
      sections={[
        {
          title: "Criar uma URL rastreável",
          description:
            "Use o UTM Builder para padronizar origem, mídia e campanha.",
          href: "/gerar-utm",
          action: "Abrir UTM Builder",
        },
        {
          title: "Transformar uma URL em QR Code",
          description:
            "Gere e baixe um QR Code pronto para materiais digitais ou impressos.",
          href: "/gerar-qrcode",
          action: "Gerar QR Code",
        },
        {
          title: "Centralizar seu trabalho",
          description:
            "Crie uma conta gratuita para guardar links e acompanhar resultados.",
          href: "/cadastro",
          action: "Criar conta",
        },
      ]}
    />
  );
}

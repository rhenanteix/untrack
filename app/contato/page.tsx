import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Contato",
  description: "Encontre o melhor ponto de partida para usar a Untrack.",
  alternates: { canonical: "/contato" },
};

export default function ContactPage() {
  return (
    <StaticInfoPage
      eyebrow="Contato"
      title="Vamos começar pelo seu próximo link."
      description="Escolha uma ferramenta para testar agora ou crie uma conta para centralizar seus links, campanhas e resultados."
      sections={[
        {
          title: "Experimentar uma ferramenta",
          description:
            "Limpe, analise, marque com UTM ou transforme uma URL em QR Code sem criar uma conta antes.",
          href: "/produtos",
          action: "Ver ferramentas",
        },
        {
          title: "Criar uma conta",
          description:
            "Guarde seu trabalho e acesse o dashboard para continuar com mais recursos.",
          href: "/cadastro",
          action: "Começar grátis",
        },
      ]}
    />
  );
}

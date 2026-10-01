import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Sobre",
  description:
    "Conheça a visão da Untrack para o trabalho com links e campanhas.",
  alternates: { canonical: "/sobre" },
};

export default function AboutPage() {
  return (
    <StaticInfoPage
      eyebrow="Sobre a Untrack"
      title="Links são pontos de decisão, não apenas endereços."
      description="A Untrack reúne criação, organização e análise para que links e campanhas possam ser acompanhados como parte do trabalho diário."
      sections={[
        {
          title: "Comece simples",
          description:
            "Uma ferramenta específica resolve a tarefa imediata sem criar uma barreira para experimentar.",
          href: "/produtos",
          action: "Explorar produtos",
        },
        {
          title: "Conecte o contexto",
          description:
            "Quando precisar de mais controle, links, campanhas e resultados ficam no mesmo dashboard.",
          href: "/cadastro",
          action: "Começar grátis",
        },
      ]}
    />
  );
}

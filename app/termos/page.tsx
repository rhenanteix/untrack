import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Termos",
  robots: { index: false, follow: false },
};

export default function TermsPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Termos públicos em atualização."
      description="Os termos de uso completos ainda não estão publicados nesta versão. Esta página não cria obrigações nem substitui qualquer acordo aplicável."
      sections={[
        {
          title: "Ferramentas disponíveis",
          description:
            "Explore as capacidades reais da plataforma antes de criar sua conta.",
          href: "/produtos",
          action: "Ver produtos",
        },
      ]}
    />
  );
}

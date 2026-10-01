import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Cookies",
  robots: { index: false, follow: false },
};

export default function CookiesPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Informações de cookies em atualização."
      description="A política completa de cookies ainda não está publicada nesta versão. Esta página não substitui uma política de cookies aplicável."
      sections={[
        {
          title: "Sessão e primeiro uso",
          description:
            "A aplicação utiliza sessão autenticada e controle técnico de uso anônimo para operar os fluxos disponíveis.",
        },
      ]}
    />
  );
}

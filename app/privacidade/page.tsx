import type { Metadata } from "next";
import { StaticInfoPage } from "@/components/static-info-page";

export const metadata: Metadata = {
  title: "Privacidade",
  robots: { index: false, follow: false },
};

export default function PrivacyPage() {
  return (
    <StaticInfoPage
      eyebrow="Legal"
      title="Informações de privacidade em atualização."
      description="A política pública completa ainda não está publicada nesta versão. Não use esta página como substituta de termos contratuais ou política de privacidade aplicável."
      sections={[
        {
          title: "Uso das ferramentas",
          description:
            "O primeiro uso anônimo é controlado por um identificador técnico para aplicar o limite gratuito compartilhado.",
        },
        {
          title: "Próximo passo",
          description:
            "Use Ajuda para acessar as ferramentas disponíveis e criar uma conta quando precisar continuar.",
          href: "/ajuda",
          action: "Abrir Ajuda",
        },
      ]}
    />
  );
}

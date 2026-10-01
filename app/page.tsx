import Link from "next/link";
import { smartPagesPrice } from "@/modules/billing/plans";
import type { Metadata } from "next";
import { LinkCleaner } from "@/components/link-cleaner";
import { SeoContent } from "@/components/seo-content";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return (
    <>
      <section className="hero shell">
        <div className="eyebrow">
          Links mais limpos, compartilhamentos melhores
        </div>
        <h1>Arrume qualquer link em segundos.</h1>
        <p className="hero-copy">
          Limpe rastreadores, organize URLs, crie UTMs e gere QR Codes sem
          complicação.
        </p>
        <LinkCleaner />
      </section>
      <section className="sp-premium-banner"><span className="eyebrow">Smart Pages Premium</span><h2>Um cartão digital para tudo o que você faz.</h2><p>Reúna seu portfólio, redes sociais e contatos em uma página com sua identidade. Personalize com prévia ao vivo.</p><strong>{smartPagesPrice}</strong><p>Preço previsto · cobrança ainda não disponível.</p><Link className="button" href="/untrack/smart-pages">Conhecer no meu perfil</Link></section>
      <SeoContent />
    </>
  );
}

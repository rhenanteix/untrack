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
      <SeoContent />
    </>
  );
}

import type { Metadata } from "next";
import { LinkAnalyzer } from "@/components/link-analyzer";

export const metadata: Metadata = {
  title: "Link Analyzer",
  description:
    "Analise uma URL para entender domínio, parâmetros, redirects e sinais técnicos antes de compartilhar.",
  alternates: { canonical: "/analisar-link" },
};

export default function AnalyzeLinkPage() {
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Link Intelligence</span>
        <h1>Entenda o que existe por trás de uma URL.</h1>
        <p>
          Analise domínio, parâmetros, redirects e sinais técnicos sem alterar o
          destino do seu link.
        </p>
      </div>
      <LinkAnalyzer />
    </section>
  );
}

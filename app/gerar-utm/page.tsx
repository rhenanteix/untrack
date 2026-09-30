import type { Metadata } from "next";
import { UtmBuilder } from "@/components/utm-builder";

export const metadata: Metadata = {
  title: "Criar UTM",
  description:
    "Crie URLs de campanha com parâmetros UTM codificados corretamente.",
  alternates: { canonical: "/gerar-utm" },
};

export default function UtmPage() {
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Construtor de campanha</span>
        <h1>Crie UTMs claras e consistentes.</h1>
        <p>
          Preencha os dados da campanha. Nós cuidamos da codificação e
          preservamos parâmetros existentes.
        </p>
      </div>
      <UtmBuilder />
      <article className="prose-card">
        <h2>Como criar uma boa UTM?</h2>
        <p>
          Use nomes curtos e consistentes. Source identifica a origem, medium
          descreve o canal e campaign nomeia a iniciativa. Term e content são
          opcionais e ajudam a diferenciar palavras-chave ou peças.
        </p>
      </article>
    </section>
  );
}

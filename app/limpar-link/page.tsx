import type { Metadata } from "next";
import { LinkCleaner } from "@/components/link-cleaner";

export const metadata: Metadata = {
  title: "Limpar link",
  description:
    "Remova UTMs e parâmetros de rastreamento sem apagar parâmetros importantes.",
  alternates: { canonical: "/limpar-link" },
};

export default function CleanLinkPage() {
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Limpador de URL</span>
        <h1>Compartilhe só o que importa.</h1>
        <p>
          Remova rastreadores conhecidos e preserve parâmetros necessários para
          a página funcionar.
        </p>
      </div>
      <LinkCleaner />
    </section>
  );
}

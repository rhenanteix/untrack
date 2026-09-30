import type { Metadata } from "next";
import { LinkHealth } from "@/components/link-health";

export const metadata: Metadata = {
  title: "Link Health",
  description:
    "Avalie sinais de saúde técnica de uma URL com checks e pontuação explicável.",
  alternates: { canonical: "/link-health" },
};

export default function LinkHealthPage() {
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Checks técnicos</span>
        <h1>Link Health</h1>
        <p>
          Confira HTTPS, resposta HTTP, redirects e outros sinais encontrados.
          Cada ponto tem uma razão; o resultado não é uma garantia de segurança.
        </p>
      </div>
      <LinkHealth />
    </section>
  );
}

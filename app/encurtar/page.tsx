import type { Metadata } from "next";
import { Shortener } from "@/components/shortener";

export const metadata: Metadata = {
  title: "Encurtar link",
  description:
    "Crie links curtos, compartilhe e acompanhe os cliques em sua conta.",
  alternates: { canonical: "/encurtar" },
};

export default async function ShortenPage({
  searchParams,
}: {
  searchParams: Promise<{ url?: string }>;
}) {
  const params = await searchParams;
  const url = typeof params.url === "string" ? params.url.slice(0, 4096) : "";
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Encurtador de links</span>
        <h1>Um link pequeno. Um alcance maior.</h1>
        <p>
          Compartilhe um endereço curto e acompanhe os acessos sem expor suas
          métricas.
        </p>
      </div>
      <Shortener initialUrl={url} />
    </section>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { sessionFromHeaders } from "@/lib/session";
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
  const session = await sessionFromHeaders(await headers());
  const returnTo = `/encurtar${url ? `?url=${encodeURIComponent(url)}` : ""}`;
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
      {session ? (
        <Shortener initialUrl={url} />
      ) : (
        <div className="tool-card auth-card">
          <h2>Seus links precisam de um lugar para ficar.</h2>
          <p>
            Entre ou crie uma conta gratuita para gerenciar seus links e
            consultar os cliques.
          </p>
          <div className="action-row">
            <Link
              className="button"
              href={`/entrar?next=${encodeURIComponent(returnTo)}`}
            >
              Entrar
            </Link>
            <Link
              className="button button-secondary"
              href={`/cadastro?next=${encodeURIComponent(returnTo)}`}
            >
              Criar conta
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

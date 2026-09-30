import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { sessionFromHeaders } from "@/lib/session";
import { getPrisma } from "@/lib/prisma";
import { linkMetrics, serializeLink } from "@/lib/short-links";
import { CopyButton } from "@/components/copy-button";
import { LinkMetrics } from "@/components/link-metrics";

export const metadata: Metadata = {
  title: "Métricas do link",
  robots: { index: false, follow: false },
};

export default async function LinkPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await sessionFromHeaders(await headers());
  if (!session)
    redirect(`/entrar?next=${encodeURIComponent(`/conta/links/${id}`)}`);
  const link = await getPrisma().shortLink.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!link) notFound();
  const view = serializeLink(link);
  const metrics = await linkMetrics(id);
  return (
    <section className="shell page-section">
      <Link href="/conta" className="back-link">
        ← Voltar para minha conta
      </Link>
      <div className="page-heading">
        <span className="eyebrow">
          {link.isActive ? "Link ativo" : "Link desativado"}
        </span>
        <h1>{link.title || "Métricas do link"}</h1>
        <p className="account-url">{link.destinationUrl}</p>
      </div>
      <div className="tool-card">
        <div className="clean-url">
          <code>{view.shortUrl}</code>
        </div>
        <div className="action-row">
          <CopyButton value={view.shortUrl} label="Copiar link curto" />
          <CopyButton value={view.shareUrl} label="Copiar página pública" />
          <Link href={`/l/${link.slug}`} className="button button-secondary">
            Ver página pública
          </Link>
        </div>
      </div>
      <LinkMetrics id={id} initial={metrics} />
    </section>
  );
}

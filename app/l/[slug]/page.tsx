import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { publicLink } from "@/lib/short-links";
import { publicLinkUrl } from "@/lib/app-url";
import { renderQrDataUrl } from "@/modules/qr-code/qr.service";
import { qrInputSchema } from "@/modules/qr-code/qr.schemas";
import { CopyButton } from "@/components/copy-button";

export const dynamic = "force-dynamic";
const findLink = cache(publicLink);

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const link = await findLink(slug);
  return {
    title: link?.title || "Link compartilhado",
    description:
      link?.description || "Um link compartilhado com Arrume Meu Link.",
    robots: { index: false, follow: false },
    openGraph: {
      title: link?.title || "Link compartilhado",
      description: link?.description || "Confira o destino antes de continuar.",
      url: publicLinkUrl(slug, true),
      type: "website",
      siteName: "Arrume Meu Link",
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const link = await findLink(slug);
  if (!link) notFound();
  const shortUrl = publicLinkUrl(slug);
  const dataUrl = await renderQrDataUrl(
    qrInputSchema.parse({ url: shortUrl, width: 280 }),
  );
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Um link para compartilhar</span>
        <h1>{link.title || "Seu próximo destino."}</h1>
        {link.description && <p>{link.description}</p>}
      </div>
      <div className="tool-card shared-link-card">
        <div>
          <h2>Você vai para {new URL(link.destinationUrl).hostname}</h2>
          <p className="account-url">{link.destinationUrl}</p>
          <div className="action-row">
            <a className="button" href={`/s/${slug}`} rel="nofollow noreferrer">
              Abrir destino
            </a>
            <CopyButton value={shortUrl} label="Copiar link curto" />
          </div>
          <p className="privacy-note">
            Confira o endereço antes de continuar. Este link foi criado por um
            usuário.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={dataUrl}
          alt="QR Code do link curto"
          width={280}
          height={280}
        />
      </div>
    </section>
  );
}

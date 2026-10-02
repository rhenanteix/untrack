import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { PageDesign } from "@/components/smart-pages/page-design";
import { SmartPageProductTracker } from "@/components/smart-page-tracker";
import { appUrl } from "@/lib/app-url";
import { isProductPublic } from "@/modules/products/availability";
import { publicSmartPageProduct } from "@/modules/smart-pages/service";
import { smartPageThemeSchema } from "@/modules/smart-pages/schemas";

export const dynamic = "force-dynamic";

const findProduct = cache(publicSmartPageProduct);

function formatPrice(priceInCents: number, currency: string) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(priceInCents / 100);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}): Promise<Metadata> {
  const { slug, productId } = await params;
  const result = await findProduct(slug, productId);
  const product = result?.blocks[0]?.product;
  if (!result || !product || !isProductPublic(product)) return {};
  const url = new URL(
    `/page/${encodeURIComponent(slug)}/produto/${encodeURIComponent(productId)}`,
    appUrl(),
  ).href;
  return {
    title: { absolute: `${product.name} | ${result.title}` },
    description: product.description || result.description || undefined,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      url,
      title: product.name,
      description: product.description || result.description || undefined,
    },
  };
}

export default async function PublicProductPage({
  params,
}: {
  params: Promise<{ slug: string; productId: string }>;
}) {
  const { slug, productId } = await params;
  const result = await findProduct(slug, productId);
  const block = result?.blocks[0];
  const product = block?.product;
  if (!result || !block || !product || !isProductPublic(product)) notFound();
  const theme = smartPageThemeSchema.safeParse(result.theme).data ?? {
    preset: "minimal",
  };

  return (
    <section className="smart-page-public">
      <PageDesign
        title={product.name}
        description={product.description}
        avatarUrl={result.avatarUrl}
        theme={theme}
      >
        <p>{formatPrice(product.priceInCents, product.currency)}</p>
        <a className="smart-page-link" href={`/page/${encodeURIComponent(slug)}`}>
          Voltar para {result.title}
        </a>
      </PageDesign>
      <SmartPageProductTracker slug={slug} blockId={block.id} />
    </section>
  );
}
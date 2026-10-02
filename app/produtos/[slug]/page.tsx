import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductLandingTemplate } from "@/components/product-landing-template";
import { getProduct, getProductPaths } from "@/lib/products";

export function generateStaticParams() {
  return getProductPaths().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  const path = `/produtos/${product.slug}`;

  return {
    title: product.seoTitle,
    description: product.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: `${product.seoTitle} | Untrack`,
      description: product.summary,
      url: path,
      siteName: "Untrack",
      images: [{ url: `${path}/opengraph-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.seoTitle} | Untrack`,
      description: product.summary,
      images: [`${path}/opengraph-image`],
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();
  return <ProductLandingTemplate product={product} />;
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductLandingTemplate } from "@/components/product-landing-template";
import { getProduct, products } from "@/lib/products";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};
  const title = product.name === "QR Code" ? "QR Code Generator" : product.name;
  const path = `/produtos/${product.slug}`;

  return {
    title,
    description: product.summary,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: `${title} | Untrack`,
      description: product.summary,
      url: path,
      siteName: "Untrack",
      images: [{ url: `${path}/opengraph-image` }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | Untrack`,
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

import { ImageResponse } from "next/og";
import { getProduct, products } from "@/lib/products";

export const alt = "LinkOr Link Intelligence Platform";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export function generateStaticParams() {
  return products.map((product) => ({ slug: product.slug }));
}

export default async function ProductOpenGraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProduct(slug) ?? products[0];

  return new ImageResponse(
    <div
      style={{
        alignItems: "flex-start",
        background: "#f6f7f2",
        color: "#172a3a",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "74px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", fontSize: 28, fontWeight: 700 }}>
        LINKOR / LINK INTELLIGENCE
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: "#567000", display: "flex", fontSize: 26 }}>
          {product.name.toUpperCase()}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 70,
            fontWeight: 800,
            lineHeight: 1.05,
          }}
        >
          {product.headline}
        </div>
      </div>
      <div style={{ display: "flex", fontSize: 28 }}>{product.description}</div>
    </div>,
    size,
  );
}

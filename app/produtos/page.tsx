import type { Metadata } from "next";
import Link from "next/link";
import { getProductsByCategory, productCategories } from "@/lib/products";

export const metadata: Metadata = {
  title: "Produtos",
  description:
    "Conheça as ferramentas da Untrack para criar, organizar e entender links e campanhas.",
  alternates: { canonical: "/produtos" },
  openGraph: {
    title: "Produtos | Untrack",
    description:
      "Ferramentas para criar, organizar e entender links e campanhas.",
    url: "/produtos",
  },
  twitter: {
    card: "summary",
    title: "Produtos | Untrack",
    description:
      "Ferramentas para criar, organizar e entender links e campanhas.",
  },
};

export default function ProductsPage() {
  return (
    <>
      <section className="catalog-hero">
        <div className="shell">
          <span className="eyebrow">Produtos</span>
          <h1>Uma plataforma inteira para trabalhar com links.</h1>
          <p>
            Comece com uma ferramenta e conecte seus links, campanhas e
            resultados no mesmo lugar.
          </p>
        </div>
      </section>

      <div className="catalog-sections">
        {productCategories.map((category) => {
          const categoryProducts = getProductsByCategory(category.id);
          if (!categoryProducts.length) return null;
          return (
            <section
              id={category.id}
              key={category.id}
              className="catalog-section"
            >
              <div className="shell">
                <div className="catalog-section-heading">
                  <span className="eyebrow">{category.name}</span>
                  <h2>{category.description}</h2>
                </div>
                <div className="product-grid">
                  {categoryProducts.map((product) => (
                    <Link
                      key={product.slug}
                      className="product-card"
                      href={`/produtos/${product.slug}`}
                    >
                      <span>{product.name}</span>
                      <p>{product.description}</p>
                      <small>Conhecer produto</small>
                    </Link>
                  ))}
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

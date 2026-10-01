import Link from "next/link";
import {
  CommercialLink,
  CommercialPageTracker,
} from "@/components/commercial-tracking";
import type { Product } from "@/lib/products";
import { getProduct } from "@/lib/products";

function ProductCta({ product }: { product: Product }) {
  const href = product.anonymousUsage ? product.toolHref : "/cadastro";
  return (
    <CommercialLink
      className="button product-primary-cta"
      events={
        product.anonymousUsage
          ? ["product_cta_clicked", "free_tool_started"]
          : ["product_cta_clicked", "signup_clicked"]
      }
      href={href}
    >
      {product.ctaLabel}
    </CommercialLink>
  );
}

export function ProductLandingTemplate({ product }: { product: Product }) {
  const related = product.related.flatMap((slug) => {
    const item = getProduct(slug);
    return item ? [item] : [];
  });

  return (
    <>
      <CommercialPageTracker event="product_viewed" />
      <section className="product-hero">
        <div className="shell product-hero-grid">
          <div>
            <Link className="product-breadcrumb" href="/produtos">
              Produtos
            </Link>
            <span className="eyebrow">{product.name}</span>
            <h1>{product.headline}</h1>
            <p>{product.summary}</p>
            <div className="product-hero-actions">
              <ProductCta product={product} />
              <a className="button button-secondary" href="#como-funciona">
                Ver como funciona
              </a>
            </div>
            {product.anonymousUsage && (
              <p className="product-guest-note">
                Teste uma vez sem criar conta. Depois, crie sua conta para
                continuar gratuitamente.
              </p>
            )}
          </div>
          <div
            className="product-workflow-preview"
            aria-label={`Fluxo de ${product.name}`}
          >
            <span className="product-preview-label">{product.name}</span>
            <ol>
              {product.workflow.map((step, index) => (
                <li key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section id="como-funciona" className="product-section">
        <div className="shell">
          <div className="product-section-heading">
            <span className="eyebrow">Como funciona</span>
            <h2>Comece com uma tarefa. Conecte o restante quando precisar.</h2>
          </div>
          <ol className="product-workflow">
            {product.workflow.map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                <strong>{step}</strong>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="product-section product-section-alt">
        <div className="shell product-audience-grid">
          <div>
            <span className="eyebrow">Para quem é</span>
            <h2>Feito para o trabalho com links no dia a dia.</h2>
          </div>
          <p>{product.audience}</p>
        </div>
      </section>

      {related.length > 0 && (
        <section className="product-section">
          <div className="shell">
            <div className="product-section-heading product-related-heading">
              <span className="eyebrow">Use junto com</span>
              <h2>Produtos que complementam {product.name}.</h2>
            </div>
            <div className="related-products">
              {related.map((item) => (
                <CommercialLink
                  key={item.slug}
                  events={["product_related_clicked"]}
                  href={`/produtos/${item.slug}`}
                >
                  <span>{item.name}</span>
                  <small>{item.description}</small>
                </CommercialLink>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="product-final-cta">
        <div className="shell">
          <span className="eyebrow">Untrack</span>
          <h2>
            Comece com {product.name}. Encontre a plataforma inteira quando
            precisar.
          </h2>
          <ProductCta product={product} />
        </div>
      </section>
    </>
  );
}

"use client";

import Link from "next/link";
import {
  CommercialLink,
  CommercialPageTracker,
} from "@/components/commercial-tracking";
import { usePublicLanguage } from "@/components/public-language-provider";
import { getFreeTools, getProduct } from "@/lib/products";

const freeToolLabels = {
  "qr-code": "Criar QR Code",
  "utm-builder": "Criar UTM",
  "short-links": "Encurtar link",
} as const;

export function LandingPage() {
  const { copy } = usePublicLanguage();
  const home = copy.home;
  const freeTools = getFreeTools();
  const intelligenceProducts = [
    getProduct("analisar-link"),
    getProduct("limpar-link"),
    getProduct("link-health"),
  ].flatMap((product) => (product ? [product] : []));
  const linkInBio = getProduct("link-in-bio");
  const campaigns = getProduct("campanhas");
  const analytics = getProduct("analytics");
  const monitoring = getProduct("monitoring");
  return (
    <>
      <CommercialPageTracker event="landing_viewed" />
      <section className="commercial-hero">
        <div className="shell commercial-hero-grid">
          <div className="commercial-hero-copy">
            <span className="eyebrow">Link Intelligence Platform</span>
            <h1>Seus links podem fazer muito mais.</h1>
            <p>
              Crie, organize, acompanhe e otimize seus links e campanhas em um
              só lugar.
            </p>
            <div className="commercial-actions">
              <CommercialLink
                className="button"
                events={["signup_clicked", "navigation_cta_clicked"]}
                analyticsContext={{ source: "home", location: "hero" }}
                href="/cadastro?next=/conta"
              >
                Começar grátis
              </CommercialLink>
              <Link className="button button-secondary" href="#ferramentas">
                Explorar produtos
              </Link>
            </div>
          </div>
          <div className="dashboard-preview" aria-label={home.dashboardLabel}>
            <div className="dashboard-preview-bar">
              <strong>{home.overview}</strong>
              <span>Exemplo ilustrativo</span>
            </div>
            <div className="dashboard-preview-metrics">
              <div>
                <span>{home.clicks}</span>
                <strong>--</strong>
                <small>acompanhe tendências</small>
              </div>
              <div>
                <span>{home.activeLinks}</span>
                <strong>--</strong>
                <small>entenda origens</small>
              </div>
              <div>
                <span>Campanhas</span>
                <strong>--</strong>
                <small>compare resultados</small>
              </div>
            </div>
            <div className="dashboard-preview-content">
              <section>
                <div className="preview-section-title">
                  <strong>{home.clicksByDay}</strong>
                  <span>Analytics</span>
                </div>
                <div className="preview-chart" aria-hidden="true">
                  {[28, 42, 33, 66, 51, 78, 61, 88, 72, 96, 84, 100].map(
                    (height, index) => (
                      <i key={index} style={{ height: `${height}%` }} />
                    ),
                  )}
                </div>
              </section>
              <section className="preview-link-list">
                <div className="preview-section-title">
                  <strong>{home.recentLinks}</strong>
                  <span>{home.seeAll}</span>
                </div>
                <p><b>Campanhas</b><span>organizar</span></p>
                <p><b>Links</b><span>acompanhar</span></p>
                <p><b>Health</b><span>monitorar</span></p>
              </section>
            </div>
            <div className="dashboard-preview-alert">
              <strong>{home.springCampaign}</strong>
              <span>{home.campaignStatus}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="ferramentas" className="commercial-tools">
        <div className="shell">
          <div className="commercial-section-heading">
            <span className="eyebrow">Ferramentas gratuitas</span>
            <h2>Comece com uma ferramenta gratuita.</h2>
            <p>
              Experimente, resolva uma tarefa agora e descubra o próximo passo
              quando fizer sentido.
            </p>
          </div>
          <div className="free-tool-grid">
            {freeTools.map((product) => (
              <article key={product.slug} className="free-tool-card">
                <span className="eyebrow">Grátis para experimentar</span>
                <h3>{product.name}</h3>
                <p>{product.description}</p>
                <CommercialLink
                  className="text-link"
                  events={["navigation_free_tool_clicked"]}
                  analyticsContext={{
                    product: product.slug,
                    category: product.category,
                    source: "home",
                    location: "free-tools",
                  }}
                  href={product.toolHref}
                >
                  {freeToolLabels[product.slug as keyof typeof freeToolLabels]}
                </CommercialLink>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="commercial-intelligence">
        <div className="shell">
          <div className="commercial-section-heading">
            <span className="eyebrow">Link Intelligence</span>
            <h2>Seus links estão realmente bons?</h2>
            <p>Não basta criar um link. Entenda o que existe por trás dele.</p>
          </div>
          <div className="intelligence-grid">
            {intelligenceProducts.map((product) => (
              <Link key={product.slug} className="intelligence-card" href={`/produtos/${product.slug}`}>
                <strong>{product.name}</strong>
                <span>{product.description}</span>
              </Link>
            ))}
          </div>
          <Link className="text-link" href="/produtos#intelligence">
            Explorar inteligência
          </Link>
        </div>
      </section>

      {linkInBio && (
        <section className="link-in-bio-section">
          <div className="shell link-in-bio-grid">
            <div>
              <span className="eyebrow">Link in Bio</span>
              <h2>Uma página para tudo.</h2>
              <p>
                Reúna seus links, canais, produtos e conteúdos em uma única
                página e acompanhe o que acontece depois do clique.
              </p>
              <CommercialLink
                className="button"
                events={["navigation_link_in_bio_clicked"]}
                analyticsContext={{
                  product: linkInBio.slug,
                  category: linkInBio.category,
                  source: "home",
                  location: "link-in-bio",
                }}
                href={`/produtos/${linkInBio.slug}`}
              >
                Criar meu Link in Bio
              </CommercialLink>
            </div>
            <div className="link-in-bio-preview" aria-label="Exemplo de uma página Link in Bio">
              <span>Exemplo de página</span>
              <strong>Seu próximo destino começa aqui.</strong>
              <p>Links, produtos, WhatsApp e campanhas em uma página só.</p>
              <i>Conteúdo em destaque</i>
              <i>Fale no WhatsApp</i>
              <i>Conheça a campanha</i>
            </div>
          </div>
        </section>
      )}

      {campaigns && (
        <section className="commercial-campaigns">
          <div className="shell">
            <div className="commercial-section-heading">
              <span className="eyebrow">Campanhas</span>
              <h2>Transforme links em campanhas.</h2>
              <p>Conecte cada ativo ao contexto que explica sua origem, distribuição e resultado.</p>
            </div>
            <ol className="campaign-flow">
              {["Campanha", "UTM", "Links", "QR Code", "Link in Bio", "Analytics"].map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <CommercialLink
              className="text-link"
              events={["navigation_product_clicked"]}
              analyticsContext={{ product: campaigns.slug, category: campaigns.category, source: "home", location: "campaigns" }}
              href={`/produtos/${campaigns.slug}`}
            >
              Explorar campanhas
            </CommercialLink>
          </div>
        </section>
      )}

      {analytics && (
        <section className="commercial-analytics">
          <div className="shell commercial-analytics-grid">
            <div>
              <span className="eyebrow">Analytics</span>
              <h2>Saiba o que acontece depois do clique.</h2>
              <p>Entenda cliques, fontes, campanhas, dispositivos, performance e tendências na mesma plataforma.</p>
              <CommercialLink
                className="text-link"
                events={["navigation_product_clicked"]}
                analyticsContext={{ product: analytics.slug, category: analytics.category, source: "home", location: "analytics" }}
                href={`/produtos/${analytics.slug}`}
              >
                Conhecer Analytics
              </CommercialLink>
            </div>
            <div className="analytics-example" aria-label="Exemplo ilustrativo de Analytics">
              <span>Exemplo ilustrativo</span>
              <strong>Cliques, fontes e campanhas em contexto.</strong>
              <p>Use seus dados reais para identificar o que manter e o que ajustar.</p>
            </div>
          </div>
        </section>
      )}

      {monitoring && (
        <section className="commercial-monitoring">
          <div className="shell commercial-monitoring-grid">
            <div>
              <span className="eyebrow">Monitoring</span>
              <h2>Seus links precisam de atenção?</h2>
              <p>Acompanhe sinais que pedem revisão antes que impactem uma campanha ou uma experiência pública.</p>
              <CommercialLink
                className="button button-secondary"
                events={["navigation_product_clicked"]}
                analyticsContext={{ product: monitoring.slug, category: monitoring.category, source: "home", location: "monitoring" }}
                href={`/produtos/${monitoring.slug}`}
              >
                Conhecer Monitoring
              </CommercialLink>
            </div>
            <ul className="monitoring-signals">
              <li>Link quebrado</li>
              <li>Redirect alterado</li>
              <li>Destino alterado</li>
              <li>Timeout</li>
              <li>Degradação de performance</li>
            </ul>
          </div>
        </section>
      )}

      <section className="commercial-closing">
        <div className="shell">
          <div className="commercial-closing-copy">
            <span className="eyebrow">{home.closingEyebrow}</span>
            <h2>{home.closingTitle}</h2>
            <p>{home.closingDescription}</p>
          </div>
          <CommercialLink
            className="button commercial-closing-cta"
            events={["signup_clicked", "navigation_cta_clicked"]}
            analyticsContext={{ source: "home", location: "closing" }}
            href="/cadastro?next=/conta"
          >
            Começar grátis
          </CommercialLink>
        </div>
      </section>
    </>
  );
}
"use client";

import Link from "next/link";
import {
  CommercialLink,
  CommercialPageTracker,
} from "@/components/commercial-tracking";
import { usePublicLanguage } from "@/components/public-language-provider";
import { getProductsByCategory } from "@/lib/products";

const productGroups = [
  { id: "links", title: "linksTitle", description: "linksDescription" },
  {
    id: "campaigns",
    title: "campaignsTitle",
    description: "campaignsDescription",
  },
] as const;

export function LandingPage() {
  const { copy } = usePublicLanguage();
  const home = copy.home;
  return (
    <>
      <CommercialPageTracker event="landing_viewed" />
      <section className="commercial-hero">
        <div className="shell commercial-hero-grid">
          <div className="commercial-hero-copy">
            <span className="eyebrow">{home.eyebrow}</span>
            <h1>{home.title}</h1>
            <p>{home.subtitle}</p>
            <div className="commercial-actions">
              <CommercialLink
                className="button"
                events={["signup_clicked"]}
                href="/cadastro"
              >
                {copy.nav.startFree}
              </CommercialLink>
              <Link className="button button-secondary" href="#produtos">
                {home.explore}
              </Link>
            </div>
          </div>
          <div className="dashboard-preview" aria-label={home.dashboardLabel}>
            <div className="dashboard-preview-bar">
              <strong>{home.overview}</strong>
              <span>{home.lastDays}</span>
            </div>
            <div className="dashboard-preview-metrics">
              <div>
                <span>{home.clicks}</span>
                <strong>1.248</strong>
                <small>+18%</small>
              </div>
              <div>
                <span>{home.activeLinks}</span>
                <strong>42</strong>
                <small>6 {home.campaignsTitle.toLowerCase()}</small>
              </div>
              <div>
                <span>Smart Pages</span>
                <strong>3</strong>
                <small>{home.published}</small>
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
                <p>
                  <b>l/untrack-lancamento</b>
                  <span>428 {home.clicks.toLowerCase()}</span>
                </p>
                <p>
                  <b>QR Evento 2026</b>
                  <span>193 {home.scans}</span>
                </p>
                <p>
                  <b>WhatsApp comercial</b>
                  <span>87 {home.clicks.toLowerCase()}</span>
                </p>
              </section>
            </div>
            <div className="dashboard-preview-alert">
              <strong>{home.springCampaign}</strong>
              <span>{home.campaignStatus}</span>
            </div>
          </div>
        </div>
      </section>

      <section id="produtos" className="commercial-products">
        <div className="shell">
          <div className="commercial-section-heading">
            <span className="eyebrow">{home.productsEyebrow}</span>
            <h2>{home.productsTitle}</h2>
            <p>{home.productsDescription}</p>
          </div>
          <div className="commercial-product-groups">
            {productGroups.map((group) => (
              <article key={group.id} className="commercial-product-group">
                <div>
                  <span className="eyebrow">{home[group.title]}</span>
                  <h3>{home[group.description]}</h3>
                </div>
                <div className="commercial-product-list">
                  {getProductsByCategory(group.id).map((product) => (
                    <Link key={product.slug} href={`/produtos/${product.slug}`}>
                      <strong>{product.name}</strong>
                      <span>
                        {
                          copy.products[
                            product.slug as keyof typeof copy.products
                          ]
                        }
                      </span>
                    </Link>
                  ))}
                </div>
                <Link className="text-link" href={`/produtos#${group.id}`}>
                  {home.exploreGroup} {home[group.title]}
                </Link>
              </article>
            ))}
          </div>
          <div className="commercial-feature-row">
            <article>
              <span className="eyebrow">Smart Pages</span>
              <h3>{home.smartPagesTitle}</h3>
              <p>{home.smartPagesDescription}</p>
              <Link className="text-link" href="/produtos/smart-pages">
                {home.exploreGroup} Smart Pages
              </Link>
            </article>
            <article>
              <span className="eyebrow">Link Intelligence</span>
              <h3>{home.intelligenceTitle}</h3>
              <p>{home.intelligenceDescription}</p>
              <Link className="text-link" href="/produtos/analytics">
                {home.exploreGroup} Analytics
              </Link>
            </article>
          </div>
        </div>
      </section>

      <section className="commercial-closing">
        <div className="shell">
          <div className="commercial-closing-copy">
            <span className="eyebrow">{home.closingEyebrow}</span>
            <h2>{home.closingTitle}</h2>
            <p>{home.closingDescription}</p>
          </div>
          <CommercialLink
            className="button commercial-closing-cta"
            events={["signup_clicked"]}
            href="/cadastro"
          >
            {copy.nav.startFree}
          </CommercialLink>
        </div>
      </section>
    </>
  );
}
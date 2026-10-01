import Link from "next/link";
import type { Metadata } from "next";
import { LinkCleaner } from "@/components/link-cleaner";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const products = [
  {
    href: "/untrack/smart-pages",
    title: "Smart Pages",
    description:
      "Seu cartão digital profissional. Reúna links, portfólio e redes sociais em uma página com a sua identidade.",
    tag: "Destaque",
  },
  {
    href: "/limpar-link",
    title: "Limpar link",
    description:
      "Remova rastreadores e parâmetros desnecessários. Cole seu link e veja o resultado limpo.",
  },
  {
    href: "/gerar-utm",
    title: "UTM Builder",
    description:
      "Crie parâmetros UTM organizados para suas campanhas de marketing.",
  },
  {
    href: "/gerar-qrcode",
    title: "QR Code",
    description:
      "Gere QR Codes em PNG de alta qualidade para cartões, flyers e eventos.",
  },
  {
    href: "/encurtar",
    title: "Short Links",
    description:
      "Encurte URLs longas em links curtos e personalizados.",
  },
  {
    href: "/link-health",
    title: "Link Health",
    description:
      "Verifique se seus links estão acessíveis e funcionando corretamente.",
  },
];

const stats = [
  { value: "100k+", label: "Links processados" },
  { value: "12k+", label: "Usuários ativos" },
  { value: "6", label: "Ferramentas" },
];

const steps = [
  {
    num: "1",
    title: "Escolha",
    description: "Selecione a ferramenta: Smart Pages, limpeza, UTM, QR Code e mais.",
  },
  {
    num: "2",
    title: "Configure",
    description: "Interface simples. Cole seu link, ajuste e veja o resultado em tempo real.",
  },
  {
    num: "3",
    title: "Compartilhe",
    description: "Copie, baixe ou compartilhe. Tudo pronto para usar.",
  },
];

export default function Home() {
  return (
    <>
      {/* ── HERO ───────────────────────────────────────────── */}
      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-badge">Plataforma de links inteligente</div>
          <h1>
            Seus links,<br />
            <span className="lp-gradient-text">organizados</span> e{" "}
            <span className="lp-gradient-text">rastreáveis</span>.
          </h1>
          <p className="lp-hero-subtitle">
            Smart Pages, limpeza de URLs, encurtador, UTMs, QR Codes e saúde de
            links — tudo em um só lugar.
          </p>
          <div className="lp-hero-actions">
            <Link className="lp-btn lp-btn-primary" href="/conta">
              Começar gratuitamente
            </Link>
            <Link className="lp-btn lp-btn-ghost" href="#produtos">
              Ver produtos
            </Link>
          </div>

          {/* ── Social proof ─────────────────────────────── */}
          <div className="lp-hero-stats">
            {stats.map((stat) => (
              <div key={stat.label} className="lp-hero-stat">
                <strong>{stat.value}</strong>
                <span>{stat.label}</span>
              </div>
            ))}
          </div>

          {/* ── Product preview ─────────────────────────── */}
          <div className="lp-hero-preview">
            <div className="lp-browser">
              <div className="lp-browser-bar">
                <div className="lp-browser-dots">
                  <span /><span /><span />
                </div>
                <div className="lp-browser-url">untrack.app</div>
              </div>
              <div className="lp-browser-content">
                <div className="lp-preview-card">
                  <div className="lp-preview-avatar" />
                  <div className="lp-preview-line lp-preview-line--title" />
                  <div className="lp-preview-line lp-preview-line--bio" />
                  <div className="lp-preview-links">
                    <div className="lp-preview-link" />
                    <div className="lp-preview-link" />
                    <div className="lp-preview-link" />
                    <div className="lp-preview-link" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── PRODUCTS ──────────────────────────────────────── */}
      <section id="produtos" className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2>Tudo para seus links</h2>
            <p>
              Da limpeza de URLs ao cartão digital profissional — escolha a
              ferramenta certa.
            </p>
          </div>
          <div className="lp-products">
            {products.map((product) => (
              <Link
                key={product.href}
                href={product.href}
                className={`lp-product-item${product.tag ? " lp-product-item--featured" : ""}`}
              >
                <div className="lp-product-content">
                  {product.tag && (
                    <span className="lp-product-tag">{product.tag}</span>
                  )}
                  <span className="lp-product-title">{product.title}</span>
                  <span className="lp-product-desc">{product.description}</span>
                </div>
                <span className="lp-product-arrow" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ──────────────────────────────────── */}
      <section className="lp-section lp-section-alt">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2>Como funciona</h2>
            <p>Do zero ao link compartilhável em menos de um minuto.</p>
          </div>
          <div className="lp-steps">
            {steps.map((step) => (
              <div key={step.num} className="lp-step">
                <span className="lp-step-num">{step.num}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── DEMO ──────────────────────────────────────────── */}
      <section className="lp-section">
        <div className="lp-section-inner">
          <div className="lp-section-header">
            <h2>Experimente agora</h2>
            <p>Sem cadastro. Cole um link e veja como ele fica limpo.</p>
          </div>
          <div className="lp-demo">
            <LinkCleaner />
          </div>
        </div>
      </section>

      {/* ── CTA ───────────────────────────────────────────── */}
      <section className="lp-section lp-section-cta">
        <div className="lp-section-inner lp-cta-inner">
          <h2>Pronto para organizar seus links?</h2>
          <p>
            Crie sua conta gratuita e comece a usar todas as ferramentas.
          </p>
          <Link className="lp-btn lp-btn-primary" href="/conta">
            Começar agora
          </Link>
        </div>
      </section>
    </>
  );
}

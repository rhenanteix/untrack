"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { analytics } from "@/lib/client/analytics";
import { usePublicLanguage } from "@/components/public-language-provider";
import { publicLocales } from "@/lib/public-i18n";
import { getProductsByCategory, productCategories } from "@/lib/products";

const localeFlags = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
} as const;

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, copy } = usePublicLanguage();
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;
  const resourceLinks = [
    {
      href: "/produtos/analytics",
      label: copy.menu.analytics,
      description: copy.menu.analyticsDescription,
    },
    {
      href: "/produtos/link-analyzer",
      label: copy.menu.intelligence,
      description: copy.menu.intelligenceDescription,
    },
    {
      href: "/produtos/whatsapp",
      label: copy.menu.whatsapp,
      description: copy.menu.whatsappDescription,
    },
  ];
  const solutionLinks = [
    {
      href: "/produtos/campanhas",
      label: copy.menu.marketing,
      description: copy.menu.marketingDescription,
    },
    {
      href: "/produtos/smart-pages",
      label: copy.menu.creators,
      description: copy.menu.creatorsDescription,
    },
    {
      href: "/produtos/whatsapp",
      label: copy.menu.smallBusiness,
      description: copy.menu.smallBusinessDescription,
    },
    {
      href: "/produtos/campanhas",
      label: copy.menu.agencies,
      description: copy.menu.agenciesDescription,
    },
  ];

  function categoryLabel(category: (typeof productCategories)[number]["id"]) {
    if (category === "campaigns") return copy.home.campaignsTitle;
    if (category === "experience") return copy.menu.experience;
    if (category === "intelligence") return copy.menu.intelligence;
    return copy.home.linksTitle;
  }

  function openDesktopMenu(event: React.MouseEvent<HTMLDetailsElement>) {
    if (window.matchMedia("(hover: hover)").matches) {
      event.currentTarget.open = true;
    }
  }

  function closeDesktopMenu(event: React.MouseEvent<HTMLDetailsElement>) {
    if (
      window.matchMedia("(hover: hover)").matches &&
      !event.currentTarget.matches(":focus-within")
    ) {
      event.currentTarget.open = false;
    }
  }

  if (
    pathname.startsWith("/conta") ||
    pathname.startsWith("/untrack") ||
    pathname.startsWith("/page/")
  )
    return null;
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="Untrack, início">
          <span aria-hidden="true" className="brand-mark">
            ↗
          </span>
          <span className="brand-name">Untrack</span>
        </Link>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <details
            className="header-menu"
            onMouseEnter={openDesktopMenu}
            onMouseLeave={closeDesktopMenu}
            onToggle={(event) => {
              if (event.currentTarget.open)
                analytics.track("product_menu_opened");
            }}
          >
            <summary>{copy.nav.products}</summary>
            <div className="mega-menu mega-menu-products">
              <div className="mega-menu-intro">
                <span>{copy.menu.productsLabel}</span>
                <strong>{copy.menu.productsTitle}</strong>
                <Link className="mega-menu-all" href="/produtos">
                  {copy.menu.allProducts}
                </Link>
              </div>
              <div className="mega-menu-groups">
                {productCategories.map((category) => {
                  const categoryProducts = getProductsByCategory(category.id);
                  if (!categoryProducts.length) return null;
                  return (
                    <section key={category.id}>
                      <strong>{categoryLabel(category.id)}</strong>
                      {categoryProducts.map((product) => (
                        <Link
                          key={product.slug}
                          href={`/produtos/${product.slug}`}
                        >
                          {product.name}
                        </Link>
                      ))}
                    </section>
                  );
                })}
              </div>
            </div>
          </details>
          <details
            className="header-menu"
            onMouseEnter={openDesktopMenu}
            onMouseLeave={closeDesktopMenu}
          >
            <summary>{copy.nav.resources}</summary>
            <div className="mega-menu mega-menu-simple">
              {resourceLinks.map((link) => (
                <Link key={link.href} href={link.href}>
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </Link>
              ))}
              <Link className="mega-menu-all" href="/recursos">
                {copy.menu.allResources}
              </Link>
            </div>
          </details>
          <Link className="header-link" href="/precos">
            {copy.nav.pricing}
          </Link>
          <details
            className="header-menu"
            onMouseEnter={openDesktopMenu}
            onMouseLeave={closeDesktopMenu}
          >
            <summary>{copy.nav.solutions}</summary>
            <div className="mega-menu mega-menu-simple">
              {solutionLinks.map((link) => (
                <Link key={link.label} href={link.href}>
                  <strong>{link.label}</strong>
                  <span>{link.description}</span>
                </Link>
              ))}
            </div>
          </details>
        </nav>

        <div className="header-actions">
          <div className="header-language" role="group" aria-label={copy.languageLabel}>
            {publicLocales.map((language) => (
              <button
                key={language}
                type="button"
                className="language-option"
                aria-label={copy.languages[language]}
                aria-pressed={locale === language}
                title={copy.languages[language]}
                onClick={() => setLocale(language)}
              >
                <span aria-hidden="true">{localeFlags[language]}</span>
              </button>
            ))}
          </div>
          <Link
            className="header-login"
            href="/entrar"
            onClick={() => analytics.track("login_clicked")}
          >
            {copy.nav.signIn}
          </Link>
          <Link
            className="button button-small header-cta"
            href="/cadastro"
            onClick={() => analytics.track("signup_clicked")}
          >
            <span className="cta-long">{copy.nav.startFree}</span>
            <span className="cta-short">{copy.nav.startFree}</span>
          </Link>
        </div>

        <button
          type="button"
          className="menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-nav"
          onClick={() => setOpenedAt(open ? null : pathname)}
        >
          <span className="sr-only">{open ? "Fechar menu" : "Abrir menu"}</span>
          <span aria-hidden="true" className="menu-icon">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div id="mobile-nav" className="mobile-nav" hidden={!open}>
        <nav className="shell" aria-label="Navegação do menu">
          <Link href="/produtos" onClick={() => setOpenedAt(null)}>
            {copy.nav.products}
          </Link>
          {productCategories.map((category) => (
            <details key={category.id} className="mobile-nav-group">
              <summary>{categoryLabel(category.id)}</summary>
              {getProductsByCategory(category.id).map((product) => (
                <Link
                  key={product.slug}
                  href={`/produtos/${product.slug}`}
                  aria-current={
                    pathname === `/produtos/${product.slug}`
                      ? "page"
                      : undefined
                  }
                  onClick={() => setOpenedAt(null)}
                >
                  {product.name}
                </Link>
              ))}
            </details>
          ))}
          <Link href="/precos" onClick={() => setOpenedAt(null)}>
            {copy.nav.pricing}
          </Link>
          <Link href="/recursos" onClick={() => setOpenedAt(null)}>
            {copy.nav.resources}
          </Link>
          <Link href="/entrar" onClick={() => setOpenedAt(null)}>
            {copy.nav.signIn}
          </Link>
          <Link
            className="button"
            href="/cadastro"
            onClick={() => setOpenedAt(null)}
          >
            {copy.nav.startFree}
          </Link>
        </nav>
      </div>
    </header>
  );
}

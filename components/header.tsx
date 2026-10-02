"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { analytics } from "@/lib/client/analytics";
import { usePublicLanguage } from "@/components/public-language-provider";
import { publicLocales } from "@/lib/public-i18n";
import {
  getFreeTools,
  getProduct,
  getProductsForMenuCategory,
  productMenuCategories,
} from "@/lib/products";

const localeFlags = {
  "pt-BR": "🇧🇷",
  en: "🇺🇸",
  es: "🇪🇸",
} as const;

const staticTopLevelRoutes = new Set([
  "admin",
  "ajuda",
  "analisar-link",
  "api",
  "blog",
  "cadastro",
  "c",
  "conta",
  "contato",
  "cookies",
  "encurtar",
  "entrar",
  "gerar-qrcode",
  "gerar-utm",
  "l",
  "limpar-link",
  "link-health",
  "new",
  "onboarding",
  "page",
  "precos",
  "privacidade",
  "produtos",
  "q",
  "recursos",
  "s",
  "sobre",
  "termos",
  "untrack",
  "w",
]);

function isPublicSmartPagePath(pathname: string) {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length === 1 && !staticTopLevelRoutes.has(segments[0] ?? "");
}

export function Header() {
  const pathname = usePathname();
  const { locale, setLocale, copy } = usePublicLanguage();
  const [desktopMenu, setDesktopMenu] = useState<
    "products" | "solutions" | "resources" | null
  >(null);
  const [mobileOpenedAt, setMobileOpenedAt] = useState<string | null>(null);
  const desktopMenuRefs = useRef<Array<HTMLDetailsElement | null>>([]);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const menuToggleRef = useRef<HTMLButtonElement>(null);
  const mobileOpen = mobileOpenedAt === pathname;
  const freeTools = getFreeTools();
  const linkInBio = getProduct("link-in-bio");
  const resourceLinks = [
    {
      href: "/blog",
      label: "Blog",
      description: "Ideias e referências para trabalhar melhor com links.",
    },
    {
      href: "/recursos",
      label: "Guias",
      description: "Conteúdos para criar, organizar e acompanhar links.",
    },
    {
      href: "/ajuda",
      label: "Central de ajuda",
      description: "Respostas para usar as ferramentas e a plataforma.",
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
    {
      href: "/produtos/monitoring",
      label: "Times",
      description: "Organize, monitore e acompanhe links importantes.",
    },
  ];

  useEffect(() => {
    function closeMenusOnOutsidePress(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      const isInDesktopMenu = desktopMenuRefs.current.some((menu) =>
        menu?.contains(target),
      );
      if (!isInDesktopMenu) setDesktopMenu(null);
      if (
        !mobileNavRef.current?.contains(target) &&
        !menuToggleRef.current?.contains(target)
      ) {
        setMobileOpenedAt(null);
      }
    }

    function closeMenusOnEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setDesktopMenu(null);
      setMobileOpenedAt(null);
      menuToggleRef.current?.focus();
    }

    document.addEventListener("pointerdown", closeMenusOnOutsidePress);
    document.addEventListener("keydown", closeMenusOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeMenusOnOutsidePress);
      document.removeEventListener("keydown", closeMenusOnEscape);
    };
  }, []);

  function openDesktopMenu(
    event: React.MouseEvent<HTMLDetailsElement>,
    menu: "products" | "solutions" | "resources",
  ) {
    if (window.matchMedia("(hover: hover)").matches) {
      setDesktopMenu(menu);
    }
  }

  function closeDesktopMenu(event: React.MouseEvent<HTMLDetailsElement>) {
    if (
      window.matchMedia("(hover: hover)").matches &&
      !event.currentTarget.matches(":focus-within")
    ) {
      setDesktopMenu(null);
    }
  }

  function trackProductNavigation(
    product: string,
    category: string,
    source: "menu" | "free-tools" | "featured",
    location: "desktop" | "mobile",
  ) {
    const context = { product, category, source, location };
    if (source === "free-tools") {
      analytics.track("navigation_free_tool_clicked", context);
      return;
    }
    if (source === "featured") {
      analytics.track("navigation_link_in_bio_clicked", context);
      return;
    }
    analytics.track("navigation_product_category_clicked", context);
    analytics.track("navigation_product_clicked", context);
  }

  if (
    pathname.startsWith("/conta") ||
    pathname.startsWith("/untrack") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/page/") ||
    isPublicSmartPagePath(pathname)
  )
    return null;
  return (
    <header className="site-header">
      <div className="shell header-inner">
        <Link className="brand" href="/" aria-label="LinkOr, início">
          <span aria-hidden="true" className="brand-logo" />
        </Link>

        <nav className="desktop-nav" aria-label="Navegação principal">
          <details
            ref={(element) => {
              desktopMenuRefs.current[0] = element;
            }}
            className="header-menu"
            open={desktopMenu === "products"}
            onMouseEnter={(event) => openDesktopMenu(event, "products")}
            onMouseLeave={closeDesktopMenu}
            onToggle={(event) => {
              if (event.currentTarget.open) {
                setDesktopMenu("products");
                analytics.track("product_menu_opened");
                analytics.track("navigation_product_menu_opened", {
                  source: "header",
                  location: "desktop",
                });
              } else {
                setDesktopMenu(null);
              }
            }}
          >
            <summary>{copy.nav.products}</summary>
            <div className="mega-menu mega-menu-products">
              {linkInBio && (
                <section className="mega-menu-featured">
                  <span>Em destaque</span>
                  <strong>{linkInBio.name}</strong>
                  <p>{linkInBio.description}</p>
                  <Link
                    className="mega-menu-featured-cta"
                    href={`/produtos/${linkInBio.slug}`}
                    onClick={() =>
                      trackProductNavigation(
                        linkInBio.slug,
                        linkInBio.category,
                        "featured",
                        "desktop",
                      )
                    }
                  >
                    Criar meu Link in Bio
                  </Link>
                </section>
              )}
              <div className="mega-menu-groups mega-menu-product-groups">
                {productMenuCategories.map((category) => (
                  <section key={category.id}>
                    <strong>{category.name}</strong>
                    <p>{category.description}</p>
                    {getProductsForMenuCategory(category).map((product) => (
                      <Link
                        key={product.slug}
                        href={`/produtos/${product.slug}`}
                        onClick={() =>
                          trackProductNavigation(
                            product.slug,
                            category.id,
                            "menu",
                            "desktop",
                          )
                        }
                      >
                        <b>{product.name}</b>
                        <span>{product.description}</span>
                      </Link>
                    ))}
                  </section>
                ))}
              </div>
              <section className="mega-menu-free-tools">
                <div>
                  <span>Ferramentas gratuitas</span>
                  <strong>Crie sua conta gratuita para começar.</strong>
                </div>
                <div>
                  {freeTools.map((product) => (
                    <Link
                      key={product.slug}
                      href={`/cadastro?next=${encodeURIComponent(product.toolHref)}`}
                      onClick={() =>
                        trackProductNavigation(
                          product.slug,
                          product.category,
                          "free-tools",
                          "desktop",
                        )
                      }
                    >
                      {product.name}
                    </Link>
                  ))}
                  <Link className="mega-menu-all" href="/produtos">
                    Experimentar grátis
                  </Link>
                </div>
              </section>
            </div>
          </details>
          <details
            ref={(element) => {
              desktopMenuRefs.current[1] = element;
            }}
            className="header-menu"
            open={desktopMenu === "solutions"}
            onMouseEnter={(event) => openDesktopMenu(event, "solutions")}
            onMouseLeave={closeDesktopMenu}
            onToggle={(event) =>
              setDesktopMenu(event.currentTarget.open ? "solutions" : null)
            }
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
          <details
            ref={(element) => {
              desktopMenuRefs.current[2] = element;
            }}
            className="header-menu"
            open={desktopMenu === "resources"}
            onMouseEnter={(event) => openDesktopMenu(event, "resources")}
            onMouseLeave={closeDesktopMenu}
            onToggle={(event) =>
              setDesktopMenu(event.currentTarget.open ? "resources" : null)
            }
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
        </nav>

        <div className="header-actions">
          <div
            className="header-language"
            role="group"
            aria-label={copy.languageLabel}
          >
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
            href="/entrar?next=/conta"
            onClick={() => {
              analytics.track("login_clicked");
              analytics.track("navigation_cta_clicked", {
                source: "header",
                location: "login",
              });
            }}
          >
            {copy.nav.signIn}
          </Link>
          <Link
            className="button button-small header-cta"
            href="/cadastro?next=/conta"
            onClick={() => {
              analytics.track("signup_clicked");
              analytics.track("navigation_cta_clicked", {
                source: "header",
                location: "desktop",
              });
            }}
          >
            <span className="cta-long">{copy.nav.startFree}</span>
            <span className="cta-short">{copy.nav.startFree}</span>
          </Link>
        </div>

        <button
          ref={menuToggleRef}
          type="button"
          className="menu-toggle"
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav"
          onClick={() =>
            setMobileOpenedAt((openedAt) =>
              openedAt === pathname ? null : pathname,
            )
          }
        >
          <span className="sr-only">
            {mobileOpen ? "Fechar menu" : "Abrir menu"}
          </span>
          <span aria-hidden="true" className="menu-icon">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        ref={mobileNavRef}
        id="mobile-nav"
        className="mobile-nav"
        hidden={!mobileOpen}
      >
        <nav className="shell" aria-label="Navegação do menu">
          <Link href="/produtos" onClick={() => setMobileOpenedAt(null)}>
            {copy.nav.products}
          </Link>
          {productMenuCategories.map((category) => (
            <details key={category.id} className="mobile-nav-group">
              <summary>{category.name}</summary>
              {getProductsForMenuCategory(category).map((product) => (
                <Link
                  key={product.slug}
                  href={`/produtos/${product.slug}`}
                  aria-current={
                    pathname === `/produtos/${product.slug}`
                      ? "page"
                      : undefined
                  }
                  onClick={() => {
                    trackProductNavigation(
                      product.slug,
                      category.id,
                      "menu",
                      "mobile",
                    );
                    setMobileOpenedAt(null);
                  }}
                >
                  {product.name}
                </Link>
              ))}
            </details>
          ))}
          <details className="mobile-nav-group">
            <summary>{copy.nav.solutions}</summary>
            {solutionLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpenedAt(null)}
              >
                {link.label}
              </Link>
            ))}
          </details>
          <details className="mobile-nav-group">
            <summary>{copy.nav.resources}</summary>
            {resourceLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpenedAt(null)}
              >
                {link.label}
              </Link>
            ))}
          </details>
          <Link href="/precos" onClick={() => setMobileOpenedAt(null)}>
            {copy.nav.pricing}
          </Link>
          <Link
            href="/entrar?next=/conta"
            onClick={() => setMobileOpenedAt(null)}
          >
            {copy.nav.signIn}
          </Link>
          <Link
            className="button"
            href="/cadastro?next=/conta"
            onClick={() => {
              analytics.track("navigation_cta_clicked", {
                source: "header",
                location: "mobile",
              });
              setMobileOpenedAt(null);
            }}
          >
            {copy.nav.startFree}
          </Link>
        </nav>
      </div>
    </header>
  );
}

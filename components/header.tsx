"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/limpar-link", label: "Limpar link" },
  { href: "/gerar-utm", label: "UTM" },
  { href: "/gerar-qrcode", label: "QR Code" },
  { href: "/encurtar", label: "Encurtar" },
  { href: "/link-health", label: "Link Health" },
] as const;

export function Header() {
  const pathname = usePathname();
  // Guardar a rota em que o menu foi aberto mantém o menu fechado após
  // qualquer navegação (inclusive voltar/avançar) sem precisar de um efeito.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const open = openedAt === pathname;

  if(pathname.startsWith("/untrack") || pathname.startsWith("/page/")) return null;
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
          {links.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
        </nav>

        <Link className="button button-small header-cta" href="/conta">
          <span className="cta-long">Minha conta</span>
          <span className="cta-short">Conta</span>
        </Link>

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
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={pathname === link.href ? "page" : undefined}
              onClick={() => setOpenedAt(null)}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

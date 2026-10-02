"use client";

import Link from "next/link";
import { usePublicLanguage } from "@/components/public-language-provider";

export function Footer() {
  const { copy } = usePublicLanguage();
  const groups = [
    {
      title: copy.footer.product,
      links: [
        [copy.footer.exploreProducts, "/produtos"],
        ["Short Links", "/produtos/short-links"],
        [copy.footer.campaigns, "/produtos/campanhas"],
        ["Link in Bio", "/produtos/link-in-bio"],
      ],
    },
    {
      title: copy.footer.tools,
      links: [
        ["QR Code", "/gerar-qrcode"],
        ["UTM Builder", "/gerar-utm"],
        ["Short Links", "/encurtar"],
        ["Analisar Link", "/analisar-link"],
        ["Limpar Link", "/limpar-link"],
      ],
    },
    {
      title: copy.footer.forYou,
      links: [
        [copy.menu.marketing, "/produtos/campanhas"],
        [copy.menu.creators, "/produtos/link-in-bio"],
        [copy.menu.agencies, "/produtos/campanhas"],
        [copy.menu.smallBusiness, "/produtos/whatsapp"],
      ],
    },
    {
      title: copy.footer.company,
      links: [
        [copy.menu.analytics, "/produtos/analytics"],
        [copy.footer.resources, "/recursos"],
        ["Blog", "/blog"],
        [copy.footer.help, "/ajuda"],
        [copy.footer.about, "/sobre"],
        [copy.footer.contact, "/contato"],
        [copy.nav.pricing, "/precos"],
      ],
    },
  ];
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div className="footer-intro">
          <Link
            className="footer-wordmark"
            href="/"
            aria-label="Untrack, início"
          >
            <span aria-hidden="true">↗</span>
            Untrack
          </Link>
          <p>{copy.footer.description}</p>
          <Link className="footer-cta" href="/cadastro">
            {copy.nav.startFree}
          </Link>
        </div>
        <div className="footer-groups">
          {groups.map((group) => (
            <nav key={group.title} aria-label={group.title}>
              <strong>{group.title}</strong>
              {group.links.map(([label, href]) => (
                <Link key={`${label}-${href}`} href={href}>
                  {label}
                </Link>
              ))}
            </nav>
          ))}
        </div>
      </div>
      <div className="shell footer-bottom">
        <span>© {new Date().getFullYear()} Untrack</span>
        <nav aria-label="Legal">
          <Link href="/privacidade">{copy.footer.privacy}</Link>
          <Link href="/termos">{copy.footer.terms}</Link>
          <Link href="/cookies">{copy.footer.cookies}</Link>
        </nav>
      </div>
    </footer>
  );
}

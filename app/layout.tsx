import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PageViewTracker } from "@/lib/client/page-view-tracker";
import "./globals.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Arrume Meu Link — Limpe e organize seus links",
    template: "%s | Arrume Meu Link",
  },
  description:
    "Limpe URLs, remova rastreadores, crie UTMs e gere QR Codes gratuitamente.",
  applicationName: "Arrume Meu Link",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "Arrume Meu Link",
    title: "Arrume Meu Link — Limpe e organize seus links",
    description:
      "Limpe URLs, remova rastreadores, crie UTMs e gere QR Codes gratuitamente.",
  },
  twitter: {
    card: "summary",
    title: "Arrume Meu Link",
    description: "Cole seu link. A gente arruma.",
  },
};

export const viewport: Viewport = {
  themeColor: "#172a3a",
  colorScheme: "light",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "Arrume Meu Link",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  description:
    "Ferramenta gratuita para limpar URLs, criar UTMs e gerar QR Codes.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={manrope.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <Header />
        <main id="conteudo">{children}</main>
        <Footer />
        <PageViewTracker />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}

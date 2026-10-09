import { AuthenticatedFrame } from "@/components/untrack/authenticated-frame";
import { GoogleAnalytics } from "@/components/google-analytics";
import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { Footer } from "@/components/footer";
import { Header } from "@/components/header";
import { PublicLanguageProvider } from "@/components/public-language-provider";
import { PageViewTracker } from "@/lib/client/page-view-tracker";
import "./globals.css";
import "./workspace.css";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });
const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "LinkOr — Seus links, organizados e rastreáveis",
    template: "%s | LinkOr",
  },
  description:
    "Smart Pages, short links, UTMs, QR Codes e saúde de links em uma única plataforma.",
  applicationName: "LinkOr",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: ["/icon.svg"],
    apple: ["/icon.svg"],
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "LinkOr",
    title: "LinkOr — Seus links, organizados e rastreáveis",
    description:
      "Smart Pages, short links, UTMs, QR Codes e saúde de links em uma única plataforma.",
  },
  twitter: {
    card: "summary",
    title: "LinkOr",
    description: "Organize, rastreie e compartilhe seus links com estilo.",
  },
};

export const viewport: Viewport = {
  themeColor: "#172a3a",
  colorScheme: "light",
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: "LinkOr",
  applicationCategory: "UtilitiesApplication",
  operatingSystem: "Any",
  description:
    "Plataforma de social linking e gestão de links: Smart Pages, encurtador, UTMs, QR Codes e saúde de links.",
  offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={manrope.variable}
      data-scroll-behavior="smooth"
    >
      <head>
        <GoogleAnalytics />
      </head>
      <body>
        <PublicLanguageProvider>
          <a className="skip-link" href="#conteudo">
            Pular para o conteúdo
          </a>
          <Header />
          <main id="conteudo">
            <AuthenticatedFrame>{children}</AuthenticatedFrame>
          </main>
          <Footer />
          <PageViewTracker />
        </PublicLanguageProvider>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </body>
    </html>
  );
}

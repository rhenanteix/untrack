import { AssetLibrary } from "@/components/untrack/asset-library";
import { UtmBuilder } from "@/components/utm-builder";
import { QrGenerator } from "@/components/qr-generator";
import { Shortener } from "@/components/shortener";
import LinkHealthPage from "@/app/link-health/page";
import { notFound } from "next/navigation";
import {
  ApiPanel,
  ResourcePanel,
  UsagePanel,
} from "@/components/untrack/resources";
export default async function ModulePage({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  if (module === "short-links") return <AssetLibrary kind="links" />;
  if (module === "link-health") return <LinkHealthPage />;
  if (["utm", "qr", "short-links"].includes(module))
    return (
      <section className="shell page-section">
        <div className="page-heading">
          <span className="eyebrow">Criar e distribuir</span>
          <h1>
            {module === "utm"
              ? "Crie suas UTMs"
              : module === "qr"
                ? "Seu QR Code"
                : "Crie um short link"}
          </h1>
          <p>Crie e distribua seus links dentro do seu perfil.</p>
        </div>
        {module === "utm" ? (
          <UtmBuilder />
        ) : module === "qr" ? (
          <QrGenerator />
        ) : (
          <Shortener initialUrl="" />
        )}
      </section>
    );
  if (
    ![
      "clients",
      "domains",
      "members",
      "usage",
      "audit",
      "api",
      "folders",
    ].includes(module)
  )
    notFound();
  return (
    <section className="shell page-section">
      {module === "usage" ? (
        <UsagePanel />
      ) : module === "api" ? (
        <ApiPanel />
      ) : (
        <ResourcePanel key={module} module={module} />
      )}
    </section>
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ module: string }>;
}) {
  const { module } = await params;
  const names: Record<string, string> = {
    clients: "Clientes",
    domains: "Domínios",
    members: "Equipe",
    usage: "Plano e cotas",
    audit: "Auditoria",
    api: "API",
    folders: "Pastas",
    utm: "Construtor UTM",
    qr: "QR Codes",
    "short-links": "Links",
    "link-health": "Qualidade",
  };
  return { title: names[module] ?? "Workspace" };
}

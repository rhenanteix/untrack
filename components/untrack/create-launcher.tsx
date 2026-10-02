"use client";

import Link from "next/link";
import {
  FiCode,
  FiCreditCard,
  FiGrid,
  FiLink,
  FiPlus,
  FiTarget,
} from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";

type CreateLauncherProps = {
  compact?: boolean;
};

const popularItems = [
  { href: "/untrack/smart-pages?create=1", label: "Smart Page", description: "Sua página de links, conteúdo e conversão.", icon: FiGrid },
  { href: "/untrack/short-links?create=1", label: "Link", description: "Crie e acompanhe um link.", icon: FiLink },
  { href: "/untrack/qr", label: "QR Code", description: "Transforme qualquer destino em QR.", icon: FiCode },
] as const;

const growthItems = [
  { href: "/untrack/campaigns?create=1", label: "Campanha", description: "Agrupe ativos e acompanhe resultados.", icon: FiTarget },
  { href: "/untrack/smart-cards?create=1", label: "Smart Card", description: "Seu cartão digital profissional.", icon: FiCreditCard },
] as const;

export function CreateLauncher({ compact = false }: CreateLauncherProps) {
  return (
    <details className={`workspace-create-launcher${compact ? " is-compact" : ""}`}>
      <summary aria-label="Criar ativo" title="Criar">
        <FiPlus aria-hidden="true" />
        <span>Criar</span>
      </summary>
      <div className="workspace-create-popover">
        <strong>O que você quer criar?</strong>
        <span className="workspace-create-group">Popular</span>
        {popularItems.map((item) => {
          const Icon = item.icon;
          return <Link key={item.label} href={item.href} onClick={() => analytics.track("create_action_started", { product: item.label })}><Icon aria-hidden="true" /><span><b>{item.label}</b><small>{item.description}</small></span></Link>;
        })}
        <span className="workspace-create-group">Crescer</span>
        {growthItems.map((item) => {
          const Icon = item.icon;
          return <Link key={item.label} href={item.href} onClick={() => analytics.track("create_action_started", { product: item.label })}><Icon aria-hidden="true" /><span><b>{item.label}</b><small>{item.description}</small></span></Link>;
        })}
      </div>
    </details>
  );
}
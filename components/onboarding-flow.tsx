"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { IconType } from "react-icons";
import { FiCode, FiCreditCard, FiGrid, FiLink } from "react-icons/fi";
import { FaGlobe, FaInstagram, FaLinkedinIn, FaTiktok, FaWhatsapp, FaYoutube } from "react-icons/fa6";
import { BrandLogo } from "@/components/brand-logo";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "@/lib/client/api";

const goals = [
  { value: "creator", title: "Criar e compartilhar", text: "Reunir conteúdo, comunidade e projetos." },
  { value: "business", title: "Divulgar um negócio", text: "Transformar visitas em contatos e clientes." },
  { value: "professional", title: "Mostrar meu trabalho", text: "Apresentar experiência, portfólio e currículo." },
  { value: "personal", title: "Organizar meus links", text: "Ter um endereço pessoal para tudo que importa." },
] as const;

const networks = [
  { value: "instagram", label: "Instagram", prefix: "https://instagram.com/", icon: FaInstagram },
  { value: "tiktok", label: "TikTok", prefix: "https://tiktok.com/@", icon: FaTiktok },
  { value: "youtube", label: "YouTube", prefix: "https://youtube.com/@", icon: FaYoutube },
  { value: "linkedin", label: "LinkedIn", prefix: "https://linkedin.com/in/", icon: FaLinkedinIn },
  { value: "whatsapp", label: "WhatsApp", prefix: "https://wa.me/", icon: FaWhatsapp },
  { value: "website", label: "Site", prefix: "", icon: FaGlobe },
] as const;

const firstActions = [
  { value: "smartPage", title: "Criar minha página", text: "Reúna seus links e conteúdo em um único endereço.", href: "/untrack/smart-pages?create=1", icon: FiGrid },
  { value: "link", title: "Criar um link", text: "Encurte e acompanhe um destino.", href: "/untrack/short-links?create=1", icon: FiLink },
  { value: "qr", title: "Criar um QR Code", text: "Transforme um destino em QR Code.", href: "/untrack/qr", icon: FiCode },
  { value: "smartCard", title: "Criar meu cartão digital", text: "Compartilhe seu perfil profissional.", href: "/untrack/smart-cards?create=1", icon: FiCreditCard },
] as const;

type Goal = (typeof goals)[number]["value"];
type Network = (typeof networks)[number]["value"];
type FirstAction = (typeof firstActions)[number]["value"];

function socialUrl(option: { prefix: string }, value: string) {
  if (/^https?:\/\//i.test(value)) return value;
  return option.prefix
    ? `${option.prefix}${value.replace(/^@/, "")}`
    : `https://${value}`;
}

export function OnboardingFlow({
  returnTo,
  trialStarted = false,
}: {
  returnTo: string;
  trialStarted?: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [firstAction, setFirstAction] = useState<FirstAction | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [selected, setSelected] = useState<Network[]>([]);
  const [values, setValues] = useState<Partial<Record<Network, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    analytics.track("onboarding_started");
  }, []);

  function toggle(network: Network) {
    setSelected((current) => current.includes(network) ? current.filter((item) => item !== network) : [...current, network]);
  }

  async function finish() {
    if (!firstAction) return;
    setBusy(true);
    setError("");
    try {
      const socialLinks = selected.flatMap((network) => {
        const value = values[network]?.trim();
        const option = networks.find((item) => item.value === network)!;
        if (!value) return [];
        return [{ network, url: socialUrl(option, value) }];
      });
      await apiRequest("/api/account/onboarding", {
        method: "PATCH",
        body: JSON.stringify({ firstAction, goal, socialLinks }),
      });
      analytics.track("onboarding_completed", { product: firstAction });
      const selectedAction = firstActions.find(
        (action) => action.value === firstAction,
      );
      router.replace(returnTo === "/" ? selectedAction!.href : returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar suas escolhas.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="onboarding" aria-labelledby="onboarding-title">
      <BrandLogo size="md" />
      <div className="onboarding-progress" aria-label={`Etapa ${step} de 2`}><span style={{ width: `${step * 50}%` }} /></div>
      {step === 1 ? (
        <>
          <span className="eyebrow">Bem-vindo ao LinkOr</span>
          {trialStarted ? <p className="status-success" role="status">Seu teste Premium começou. Você tem 30 dias para explorar todos os recursos.</p> : null}
          <h1 id="onboarding-title">O que você quer fazer primeiro?</h1>
          <p>Escolha um ativo para começar. Você poderá criar os outros depois.</p>
          <div className="onboarding-goals">
            {firstActions.map((action) => {
              const Icon = action.icon;
              return <button type="button" key={action.value} aria-pressed={firstAction === action.value} onClick={() => setFirstAction(action.value)}><Icon aria-hidden="true" /><strong>{action.title}</strong><span>{action.text}</span></button>;
            })}
          </div>
          <button className="button onboarding-continue" disabled={!firstAction} onClick={() => setStep(2)}>Continuar</button>
        </>
      ) : (
        <>
          <button className="onboarding-back" type="button" onClick={() => setStep(1)}>Voltar</button>
          <span className="eyebrow">Sobre você</span>
          <h1 id="onboarding-title">Como você pretende usar o LinkOr?</h1>
          <p>Opcionalmente, escolha um contexto e inclua suas principais redes.</p>
          <div className="onboarding-goals">{goals.map((item) => <button type="button" key={item.value} aria-pressed={goal === item.value} onClick={() => setGoal(goal === item.value ? null : item.value)}><strong>{item.title}</strong><span>{item.text}</span></button>)}</div>
          <div className="onboarding-network-picker">{networks.map((network) => {
            const Icon = network.icon as IconType;
            return <button type="button" key={network.value} aria-pressed={selected.includes(network.value)} onClick={() => toggle(network.value)}><Icon aria-hidden="true" /><span>{network.label}</span></button>;
          })}</div>
          {selected.length > 0 && <div className="onboarding-network-fields">{selected.map((network) => {
            const option = networks.find((item) => item.value === network)!;
            const Icon = option.icon as IconType;
            return <label key={network}><span className="onboarding-network-label"><Icon aria-hidden="true" />{option.label}</span><div><span>{option.prefix || "https://"}</span><input value={values[network] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [network]: event.target.value }))} placeholder={network === "website" ? "seusite.com" : "seuusuario"} /></div></label>;
          })}</div>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button onboarding-continue" disabled={busy} onClick={() => void finish()}>{busy ? "Salvando..." : "Concluir"}</button>
        </>
      )}
    </section>
  );
}
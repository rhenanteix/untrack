"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/client/api";

const goals = [
  { value: "creator", title: "Criar e compartilhar", text: "Reunir conteúdo, comunidade e projetos." },
  { value: "business", title: "Divulgar um negócio", text: "Transformar visitas em contatos e clientes." },
  { value: "professional", title: "Mostrar meu trabalho", text: "Apresentar experiência, portfólio e currículo." },
  { value: "personal", title: "Organizar meus links", text: "Ter um endereço pessoal para tudo que importa." },
] as const;

const networks = [
  { value: "instagram", label: "Instagram", prefix: "https://instagram.com/" },
  { value: "tiktok", label: "TikTok", prefix: "https://tiktok.com/@" },
  { value: "youtube", label: "YouTube", prefix: "https://youtube.com/@" },
  { value: "linkedin", label: "LinkedIn", prefix: "https://linkedin.com/in/" },
  { value: "whatsapp", label: "WhatsApp", prefix: "https://wa.me/" },
  { value: "website", label: "Site", prefix: "" },
] as const;

type Goal = (typeof goals)[number]["value"];
type Network = (typeof networks)[number]["value"];

export function OnboardingFlow({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [selected, setSelected] = useState<Network[]>([]);
  const [values, setValues] = useState<Partial<Record<Network, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function toggle(network: Network) {
    setSelected((current) => current.includes(network) ? current.filter((item) => item !== network) : [...current, network]);
  }

  async function finish() {
    if (!goal) return;
    setBusy(true);
    setError("");
    try {
      const socialLinks = selected.flatMap((network) => {
        const value = values[network]?.trim();
        const option = networks.find((item) => item.value === network)!;
        if (!value) return [];
        const url = option.prefix && !/^https?:\/\//i.test(value) ? `${option.prefix}${value.replace(/^@/, "")}` : value;
        return [{ network, url }];
      });
      await apiRequest("/api/account/onboarding", { method: "PATCH", body: JSON.stringify({ goal, socialLinks }) });
      router.replace(returnTo);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar suas escolhas.");
    } finally {
      setBusy(false);
    }
  }

  return <section className="onboarding" aria-labelledby="onboarding-title">
    <div className="onboarding-progress" aria-label={`Etapa ${step} de 2`}><span style={{ width: `${step * 50}%` }} /></div>
    {step === 1 ? <>
      <span className="eyebrow">Comece do seu jeito</span>
      <h1 id="onboarding-title">O que você quer fazer com sua página?</h1>
      <p>Usaremos isso para destacar os próximos passos mais úteis para você.</p>
      <div className="onboarding-goals">{goals.map((item) => <button type="button" key={item.value} aria-pressed={goal === item.value} onClick={() => setGoal(item.value)}><strong>{item.title}</strong><span>{item.text}</span></button>)}</div>
      <button className="button onboarding-continue" disabled={!goal} onClick={() => setStep(2)}>Continuar</button>
    </> : <>
      <button className="onboarding-back" type="button" onClick={() => setStep(1)}>Voltar</button>
      <span className="eyebrow">Suas redes</span>
      <h1 id="onboarding-title">Onde as pessoas podem encontrar você?</h1>
      <p>Escolha suas principais redes e informe o usuário ou link. Você pode editar isso depois.</p>
      <div className="onboarding-network-picker">{networks.map((network) => <button type="button" key={network.value} aria-pressed={selected.includes(network.value)} onClick={() => toggle(network.value)}>{network.label}</button>)}</div>
      {selected.length > 0 && <div className="onboarding-network-fields">{selected.map((network) => {
        const option = networks.find((item) => item.value === network)!;
        return <label key={network}>{option.label}<div><span>{option.prefix || "https://"}</span><input value={values[network] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [network]: event.target.value }))} placeholder={network === "website" ? "seusite.com" : "seuusuario"} /></div></label>;
      })}</div>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button onboarding-continue" disabled={busy} onClick={() => void finish()}>{busy ? "Salvando..." : "Concluir"}</button>
    </>}
  </section>;
}
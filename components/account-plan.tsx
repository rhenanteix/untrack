"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountAccess } from "@/modules/billing/account-access";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "@/lib/client/api";

export function AccountPlan({ access }: { access: AccountAccess }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function beginTrial() {
    setBusy(true);
    setError("");
    try {
      await apiRequest("/api/account/trial", { method: "POST" });
      analytics.track("trial_started");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar o período de teste.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace-page account-settings">
      <header className="workspace-page-heading">
        <div>
          <span className="eyebrow">Conta</span>
          <h1>Meu plano</h1>
        </div>
      </header>
      <section className="workspace-panel account-settings-wide">
        <h2>Seu plano</h2>
        <p className="workspace-data-note">
          <strong>{access.basePlan === "premium" ? "Premium" : "Free"}</strong>
        </p>
        {access.accessSource === "subscription" ? (
          <>
            <p>Status: Ativo</p>
            <p className="workspace-data-note">
              Informações de faturamento aparecerão aqui quando a cobrança estiver disponível.
            </p>
          </>
        ) : access.accessSource === "trial" && access.trialExpiresAt ? (
          <>
            <h2>Teste Premium</h2>
            <p>Status: Ativo</p>
            <p>{access.daysRemaining} {access.daysRemaining === 1 ? "dia restante" : "dias restantes"}</p>
            <p className="workspace-data-note">
              Seu teste termina em {access.trialExpiresAt.toLocaleDateString("pt-BR")}.
            </p>
            <Link className="button" href="/upgrade">Conhecer Premium</Link>
          </>
        ) : access.trialStatus === "expired" ? (
          <>
            <h2>Teste Premium encerrado</h2>
            <p>Seus dados continuam seguros. Você voltou para o plano Free.</p>
            <Link className="button" href="/upgrade">Conhecer Premium</Link>
          </>
        ) : (
          <>
            <p>Você está usando o plano gratuito do LinkOr.</p>
            <button className="button" type="button" disabled={busy} onClick={() => void beginTrial()}>
              {busy ? "Iniciando teste..." : "Começar teste Premium"}
            </button>
            <Link className="button button-quiet" href="/upgrade">Conhecer Premium</Link>
          </>
        )}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
      </section>
    </section>
  );
}
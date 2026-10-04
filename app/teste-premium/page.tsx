import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { sessionFromHeaders } from "@/lib/session";

export const metadata: Metadata = {
  title: "Teste Premium",
  robots: { index: false, follow: false },
};

export default async function PremiumTrialPage() {
  if (await sessionFromHeaders(await headers())) redirect("/settings/plan");
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Teste Premium</span>
        <h1>Experimente o LinkOr Premium por 30 dias.</h1>
        <p>Crie sua conta para explorar os recursos Premium. Nenhuma cobrança será realizada.</p>
      </div>
      <AuthForm mode="register" returnTo="/settings/plan" startTrial />
    </section>
  );
}
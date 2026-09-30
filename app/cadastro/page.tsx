import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { sessionFromHeaders } from "@/lib/session";
import { safeReturnPath } from "@/modules/auth/return-path";

export const metadata: Metadata = {
  title: "Criar conta",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  if (await sessionFromHeaders(await headers())) redirect(returnTo);
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Comece por aqui</span>
        <h1>Uma conta para todos os seus links.</h1>
        <p>Crie links curtos e mantenha seu histórico sincronizado.</p>
      </div>
      <AuthForm mode="register" returnTo={returnTo} />
    </section>
  );
}

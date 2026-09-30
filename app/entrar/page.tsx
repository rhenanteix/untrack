import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { sessionFromHeaders } from "@/lib/session";
import { safeReturnPath } from "@/modules/auth/return-path";

export const metadata: Metadata = {
  title: "Entrar",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const returnTo = safeReturnPath((await searchParams).next);
  if (await sessionFromHeaders(await headers())) redirect(returnTo);
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">Sua conta</span>
        <h1>Seus links, em qualquer lugar.</h1>
        <p>Entre para encurtar, compartilhar e acompanhar seus links.</p>
      </div>
      <AuthForm mode="login" returnTo={returnTo} />
    </section>
  );
}

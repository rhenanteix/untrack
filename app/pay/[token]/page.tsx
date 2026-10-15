import type { Metadata } from "next";
import { Suspense } from "react";
import { getChargeByShareToken } from "@/modules/charges/service";
import { PublicChargePage } from "@/components/untrack/public-charge-page";

type Context = { params: Promise<{ token: string }> };

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Cobrança",
    description: "Consulte os detalhes desta cobrança.",
  };
}

async function loadCharge(token: string) {
  return getChargeByShareToken(token);
}

export default async function PayPublicPage({ params }: Context) {
  const { token } = await params;
  let charge;
  let error: { message: string } | null = null;
  try {
    charge = await loadCharge(token);
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 410) {
      error = { message: "Esta cobrança não está disponível." };
    } else {
      error = { message: "Cobrança não encontrada." };
    }
  }

  if (error)
    return <PublicChargePage message={error.message} />;

  return (
    <Suspense fallback={<p>Carregando…</p>}>
      <PublicChargePage charge={charge} />
    </Suspense>
  );
}

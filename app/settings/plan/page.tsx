import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountPlan } from "@/components/account-plan";
import { sessionFromHeaders } from "@/lib/session";
import { getAccountAccessForUser } from "@/modules/billing/account-access";

export const metadata: Metadata = {
  title: "Meu plano",
  robots: { index: false, follow: false },
};

export default async function AccountPlanPage() {
  const session = await sessionFromHeaders(await headers());
  if (!session) redirect("/entrar?next=/settings/plan");
  return <AccountPlan access={await getAccountAccessForUser(session.user.id)} />;
}
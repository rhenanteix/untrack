import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UpgradePage } from "@/components/upgrade-page";
import { sessionFromHeaders } from "@/lib/session";
import { getAccountAccessForUser } from "@/modules/billing/account-access";

export const metadata: Metadata = {
  title: "LinkOr Premium",
  robots: { index: false, follow: false },
};

export default async function UpgradeRoute() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/cadastro?next=/upgrade");
  const access = await getAccountAccessForUser(session.user.id);
  return <UpgradePage access={access} />;
}
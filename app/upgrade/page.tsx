import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { UpgradePage } from "@/components/upgrade-page";
import { sessionFromHeaders } from "@/lib/session";
import { isPremium } from "@/modules/billing/plans";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "LinkOr Premium",
  robots: { index: false, follow: false },
};

export default async function UpgradeRoute() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/cadastro?next=/upgrade");
  const actor = await actorFor(session.user.id, requestHeaders);
  const workspace = await getPrisma().workspace.findUniqueOrThrow({
    where: { id: actor.workspaceId },
    select: { plan: true },
  });
  return <UpgradePage premium={isPremium(workspace.plan)} />;
}
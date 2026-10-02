import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccountSettings } from "@/components/account-settings";
import {
  getLimit,
  getUsage,
  type UsageMetric,
} from "@/modules/billing/entitlements";
import { sessionFromHeaders } from "@/lib/session";
import { actorFor } from "@/modules/workspaces/context";
import { getPrisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Minha conta",
  robots: { index: false, follow: false },
};

const usageMetrics: UsageMetric[] = [
  "links",
  "smartPages",
  "smartCards",
  "qrCodes",
  "campaigns",
  "audienceContacts",
];

export default async function AccountSettingsPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/settings/account");
  const actor = await actorFor(session.user.id, requestHeaders);
  const [workspace, usage] = await Promise.all([
    getPrisma().workspace.findUniqueOrThrow({
      where: { id: actor.workspaceId },
      select: {
        name: true,
        slug: true,
        logoUrl: true,
        timezone: true,
        locale: true,
        notifications: true,
        plan: true,
      },
    }),
    getUsage(actor.workspaceId),
  ]);
  const notifications =
    typeof workspace.notifications === "object" &&
    workspace.notifications !== null &&
    !Array.isArray(workspace.notifications) &&
    (workspace.notifications as Record<string, unknown>).product === true;
  const limits = Object.fromEntries(
    usageMetrics.map((metric) => [metric, getLimit(workspace.plan, metric)]),
  );
  return (
    <AccountSettings
      profile={{
        name: session.user.name,
        email: session.user.email,
        image: session.user.image ?? null,
      }}
      workspace={{ ...workspace, notifications }}
      canManage={actor.role === "owner" || actor.role === "admin"}
      usage={usage}
      limits={limits}
    />
  );
}
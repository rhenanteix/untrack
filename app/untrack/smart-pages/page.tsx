import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SmartPagesDashboard } from "@/components/untrack/smart-pages-dashboard";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { listSmartPages } from "@/modules/smart-pages/service";
import { actorFor } from "@/modules/workspaces/context";

export default async function SmartPagesPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/smart-pages");
  const actor = await actorFor(session.user.id, requestHeaders);
  const [initial, managedLinks] = await Promise.all([
    listSmartPages(actor, 1),
    getPrisma().shortLink.findMany({
      where: { workspaceId: actor.workspaceId, distribution: "digital" },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: { id: true, title: true, slug: true, destinationUrl: true },
    }),
  ]);
  return (
    <SmartPagesDashboard
      initial={{
        ...initial,
        items: initial.items.map((page) => ({
          ...page,
          publishedAt: page.publishedAt?.toISOString() ?? null,
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
        })),
      }}
      managedLinks={managedLinks}
    />
  );
}

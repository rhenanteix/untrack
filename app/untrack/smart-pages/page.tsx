import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { SmartPagesDashboard } from "@/components/untrack/smart-pages-dashboard";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { listSmartPages } from "@/modules/smart-pages/service";
import {
  smartPageThemeSchema,
  socialLinksSchema,
} from "@/modules/smart-pages/schemas";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { appUrl } from "@/lib/app-url";
import { actorFor } from "@/modules/workspaces/context";

async function loadPageData(requestHeaders: Headers, userId: string) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const [initial, managedLinks] = await Promise.all([
      listSmartPages(actor, 1),
      getPrisma().shortLink.findMany({
        where: { workspaceId: actor.workspaceId, distribution: "digital" },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: { id: true, title: true, slug: true, destinationUrl: true },
      }),
    ]);
    return { ok: true as const, actor, initial, managedLinks };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Smart Pages workspace load failed", error);
    return { ok: false as const, error: failure };
  }
}

export default async function SmartPagesPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/smart-pages");
  const data = await loadPageData(requestHeaders, session.user.id);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const { actor, initial, managedLinks } = data;
  return (
    <SmartPagesDashboard
      canEdit={actor.role !== "viewer"}
      publicOrigin={appUrl().origin}
      initial={{
        ...initial,
        items: initial.items.map((page) => ({
          ...page,
          publishedAt: page.publishedAt?.toISOString() ?? null,
          createdAt: page.createdAt.toISOString(),
          updatedAt: page.updatedAt.toISOString(),
          theme: smartPageThemeSchema.safeParse(page.theme).data ?? {
            preset: "minimal",
          },
          socialLinks: socialLinksSchema.safeParse(page.socialLinks).data ?? [],
        })),
      }}
      managedLinks={managedLinks}
    />
  );
}

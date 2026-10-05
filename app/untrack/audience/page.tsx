import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AudienceDashboard } from "@/components/untrack/audience-dashboard";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { sessionFromHeaders } from "@/lib/session";
import {
  getAudienceFilterOptions,
  getAudienceOverview,
  listAudienceContacts,
  parseAudienceContactFilters,
} from "@/modules/audience/service";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { actorFor } from "@/modules/workspaces/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience" };

async function loadAudiencePage(
  requestHeaders: Headers,
  userId: string,
  rawFilters: Record<string, unknown>,
) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const filters = parseAudienceContactFilters(rawFilters);
    const [initial, overview, options] = await Promise.all([
      listAudienceContacts(actor, 1, filters),
      getAudienceOverview(actor, filters),
      getAudienceFilterOptions(actor),
    ]);
    return { ok: true as const, actor, initial, overview, options };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Audience workspace load failed", error);
    return { ok: false as const, failure };
  }
}

export default async function AudiencePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/audience");
  const rawFilters = await searchParams;
  const data = await loadAudiencePage(requestHeaders, session.user.id, rawFilters);
  if (!data.ok) return <WorkspaceLoadError {...data.failure} />;
  return (
    <AudienceDashboard
      initial={{
        ...data.initial,
        items: data.initial.items.map((contact) => ({
          ...contact,
          updatedAt: contact.updatedAt.toISOString(),
          createdAt: contact.createdAt.toISOString(),
          firstSeenAt: contact.firstSeenAt.toISOString(),
          lastSeenAt: contact.lastSeenAt.toISOString(),
          exchanges: contact.exchanges.map((exchange) => ({
            ...exchange,
            capturedAt: exchange.capturedAt.toISOString(),
          })),
          formSubmissions: contact.formSubmissions.map((submission) => ({
            ...submission,
            submittedAt: submission.submittedAt.toISOString(),
          })),
        })),
      }}
      overview={data.overview}
      filters={data.initial.filters}
      options={data.options}
      canEdit={data.actor.role !== "viewer"}
    />
  );
}

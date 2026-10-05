import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AudienceDashboard } from "@/components/untrack/audience-dashboard";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { sessionFromHeaders } from "@/lib/session";
import { listAudienceContacts } from "@/modules/audience/service";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { actorFor } from "@/modules/workspaces/context";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audience" };

async function loadAudiencePage(requestHeaders: Headers, userId: string) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const initial = await listAudienceContacts(actor, 1);
    return { ok: true as const, actor, initial };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Audience workspace load failed", error);
    return { ok: false as const, failure };
  }
}

export default async function AudiencePage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/audience");
  const data = await loadAudiencePage(requestHeaders, session.user.id);
  if (!data.ok) return <WorkspaceLoadError {...data.failure} />;
  return (
    <AudienceDashboard
      initial={{
        ...data.initial,
        items: data.initial.items.map((contact) => ({
          ...contact,
          updatedAt: contact.updatedAt.toISOString(),
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
      canEdit={data.actor.role !== "viewer"}
    />
  );
}

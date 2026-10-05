import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AudienceSegments } from "@/components/untrack/audience-segments";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { sessionFromHeaders } from "@/lib/session";
import {
  getAudienceFilterOptions,
  listAudienceSegments,
} from "@/modules/audience/service";
import { actorFor } from "@/modules/workspaces/context";
import { workspaceLoadError } from "@/modules/workspaces/load-error";

export const dynamic = "force-dynamic";
export const metadata = { title: "Segmentos" };

async function loadAudienceSegments(requestHeaders: Headers, userId: string) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const [segments, options] = await Promise.all([
      listAudienceSegments(actor),
      getAudienceFilterOptions(actor),
    ]);
    return { ok: true as const, actor, segments, options };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Audience segments workspace load failed", error);
    return { ok: false as const, failure };
  }
}

export default async function AudienceSegmentsPage() {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/audience/segments");
  const data = await loadAudienceSegments(requestHeaders, session.user.id);
  if (!data.ok) return <WorkspaceLoadError {...data.failure} />;
  return (
    <AudienceSegments
      initial={data.segments.map((segment) => ({
        ...segment,
        rules: segment.rules as never,
        updatedAt: segment.updatedAt.toISOString(),
      }))}
      options={data.options}
      canEdit={data.actor.role !== "viewer"}
    />
  );
}
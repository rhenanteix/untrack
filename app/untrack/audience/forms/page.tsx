import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { FormOverview } from "@/components/untrack/form-overview";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { sessionFromHeaders } from "@/lib/session";
import { listSmartPageFormOverviews } from "@/modules/smart-pages/forms";
import { actorFor } from "@/modules/workspaces/context";
import { workspaceLoadError } from "@/modules/workspaces/load-error";

export const dynamic = "force-dynamic";
export const metadata = { title: "Formulários" };

async function loadAudienceForms(requestHeaders: Headers, userId: string) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    return {
      ok: true as const,
      forms: await listSmartPageFormOverviews(actor),
    };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Audience forms workspace load failed", error);
    return { ok: false as const, failure };
  }
}

export default async function AudienceFormsPage({
  searchParams,
}: {
  searchParams: Promise<{ form?: string }>;
}) {
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/audience/forms");
  const [data, params] = await Promise.all([
    loadAudienceForms(requestHeaders, session.user.id),
    searchParams,
  ]);
  if (!data.ok) return <WorkspaceLoadError {...data.failure} />;
  return (
    <FormOverview
      forms={data.forms.map((form) => ({
        ...form,
        createdAt: form.createdAt.toISOString(),
        updatedAt: form.updatedAt.toISOString(),
      }))}
      selectedId={params.form}
    />
  );
}

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAccountAccessForUser } from "@/modules/billing/account-access";
import { listCharges } from "@/modules/charges/service";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { libraryFilters } from "@/modules/workspaces/library-filters";
import { actorFor } from "@/modules/workspaces/context";
import { WorkspaceLoadError } from "@/components/untrack/load-error";
import { workspaceLoadError } from "@/modules/workspaces/load-error";
import { PayDashboard } from "@/components/untrack/pay-dashboard";

async function loadPageData(
  requestHeaders: Headers,
  userId: string,
  filters: { page: number; status: string },
) {
  try {
    const actor = await actorFor(userId, requestHeaders);
    const [initial, offers, access] = await Promise.all([
      listCharges(actor, filters.page, filters.status || undefined),
      getPrisma().offer.findMany({
        where: { workspaceId: actor.workspaceId },
        orderBy: { updatedAt: "desc" },
        take: 100,
        select: { id: true, name: true, amount: true },
      }),
      getAccountAccessForUser(userId),
    ]);
    return { ok: true as const, actor, initial, offers, access };
  } catch (error) {
    const failure = workspaceLoadError(error);
    if (!["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(failure.code))
      console.error("Pay workspace load failed", error);
    return { ok: false as const, error: failure };
  }
}

export default async function PayPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const url = new URL("https://untrack.local/");
  for (const key of ["page", "status"])
    if (typeof query[key] === "string") url.searchParams.set(key, query[key]);
  let filters = { page: 1, status: "" };
  try {
    const parsed = libraryFilters(url);
    filters = { page: parsed.page, status: parsed.status };
  } catch {
    /* Invalid bookmarks fall back to the first page. */
  }
  const requestHeaders = await headers();
  const session = await sessionFromHeaders(requestHeaders);
  if (!session) redirect("/entrar?next=/untrack/pay");
  const data = await loadPageData(requestHeaders, session.user.id, filters);
  if (!data.ok) return <WorkspaceLoadError {...data.error} />;
  const { actor, initial, offers } = data;
  return (
    <PayDashboard
      canEdit={actor.role !== "viewer"}
      initial={{
        ...initial,
        items: initial.items.map((charge) => ({
          ...charge,
          createdAt: charge.createdAt.toISOString(),
          updatedAt: charge.updatedAt.toISOString(),
          dueAt: charge.dueAt ? charge.dueAt.toISOString() : null,
          paidAt: charge.paidAt ? charge.paidAt.toISOString() : null,
          cancelledAt: charge.cancelledAt ? charge.cancelledAt.toISOString() : null,
          expiredAt: charge.expiredAt ? charge.expiredAt.toISOString() : null,
          refundedAt: charge.refundedAt ? charge.refundedAt.toISOString() : null,
          customer: charge.customer
            ? {
                id: charge.customer.id,
                firstName: charge.customer.firstName,
                lastName: charge.customer.lastName,
                email: charge.customer.email,
              }
            : null,
          offer: charge.offer
            ? {
                id: charge.offer.id,
                name: charge.offer.name,
                amount: charge.offer.amount,
              }
            : null,
        })),
      }}
      offers={offers}
    />
  );
}

export const metadata = { title: "Cobranças" };

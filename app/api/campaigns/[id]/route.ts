import { NextResponse } from "next/server";
import { ApiError, errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireActor } from "@/modules/workspaces/context";
import { listIncidents, getIncident, confirmIncident, recoverIncident } from "@/modules/campaigns/incidents";
import { exportCampaignCsv, exportCampaignPdf } from "@/modules/campaigns/export";
import { testNotification, listDeliveries } from "@/modules/campaigns/notifications";
import { z } from "zod";

export const runtime = "nodejs";

function failure(error: unknown) { return errorResponse(error); }

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "incidents") {
      const channelId = url.searchParams.get("channelId");
      const incidents = await listIncidents(actor, id, channelId ?? undefined);
      return NextResponse.json({ incidents });
    }
    if (action === "deliveries") {
      const incidentId = url.searchParams.get("incidentId");
      const deliveries = await listDeliveries(actor, incidentId ?? undefined);
      return NextResponse.json({ deliveries });
    }
    if (action === "csv") {
      const csv = await exportCampaignCsv(actor, id);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="campanha-${id}.csv"` } });
    }
    if (action === "pdf") {
      const pdf = await exportCampaignPdf(actor, id);
      return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="campanha-${id}.pdf"` } });
    }

    const incidentId = url.searchParams.get("incidentId");
    if (incidentId) {
      const incident = await getIncident(actor, incidentId);
      return NextResponse.json({ incident });
    }

    throw new ApiError(400, "INVALID_ACTION", "Ação não suportada.");
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const raw = await readJson(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    let result: unknown;

    if (action === "incident-confirm") {
      const input = z.object({ incidentId: z.string() }).strict().parse(raw);
      result = await confirmIncident(actor, input.incidentId);
    } else if (action === "incident-recover") {
      const input = z.object({ incidentId: z.string() }).strict().parse(raw);
      result = await recoverIncident(actor, input.incidentId);
    } else if (action === "test-notification") {
      const input = z.object({ adapter: z.enum(["email", "webhook", "slack", "teams"]) }).strict().parse(raw);
      result = await testNotification(actor, input.adapter);
    } else {
      throw new ApiError(400, "INVALID_ACTION", "Ação não suportada.");
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

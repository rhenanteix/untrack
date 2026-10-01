import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceSameOrigin } from "@/lib/request-origin";
import { enforceRateLimit } from "@/lib/rate-limit";
import { requireActor } from "@/modules/workspaces/context";
import { assertPermission } from "@/modules/workspaces/policy";
import { listCampaigns, getCampaign, createCampaign, updateCampaign, deleteCampaign } from "@/modules/campaigns/service";
import { updateChannel, deleteChannel, updateChecklistItem, approveCampaign } from "@/modules/campaigns/service";
import { proposeKit, saveKit } from "@/modules/campaigns/kit";
import { runChecklist } from "@/modules/campaigns/checklist";
import { recordMonitorCheck } from "@/modules/campaigns/monitoring";
import { confirmIncident, recoverIncident } from "@/modules/campaigns/incidents";
import { testNotification } from "@/modules/campaigns/notifications";
import { createCampaignSchema, updateCampaignSchema, updateChannelSchema, campaignKitInputSchema, campaignKitProposalSchema } from "@/modules/campaigns/schemas";

export const runtime = "nodejs";

function failure(error: unknown) { return errorResponse(error); }

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const campaignId = url.searchParams.get("campaignId");
    if (campaignId) {
      const campaign = await getCampaign(actor, campaignId);
      return NextResponse.json({ campaign }, { headers: { "Cache-Control": "private, no-store" } });
    }
    const campaigns = await listCampaigns(actor, url.searchParams.get("status") ?? undefined);
    return NextResponse.json({ campaigns }, { headers: { "Cache-Control": "private, no-store" } });
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

    if (action === "kit-propose") {
      const input = z.object({ input: campaignKitInputSchema }).strict().parse(raw);
      result = await proposeKit(actor, input.input);
    } else if (action === "kit-save") {
      const input = z.object({ campaignId: z.string(), proposal: campaignKitProposalSchema }).strict().parse(raw);
      result = await saveKit(actor, input.campaignId, input.proposal);
    } else if (action === "checklist-run") {
      const input = z.object({ campaignId: z.string() }).strict().parse(raw);
      result = await runChecklist(actor, input.campaignId);
    } else if (action === "monitor-check") {
      const input = z.object({ campaignId: z.string(), channelId: z.string().optional(), url: z.string().optional() }).strict().parse(raw);
      result = await recordMonitorCheck(actor, input.campaignId, input.channelId, input.url);
    } else if (action === "approve") {
      const input = z.object({ campaignId: z.string(), action: z.enum(["approved", "rejected"]), notes: z.string().max(1000).optional() }).strict().parse(raw);
      result = await approveCampaign(actor, input.campaignId, input.action, input.notes ?? "");
    } else if (action === "test-notification") {
      const input = z.object({ adapter: z.enum(["email", "webhook", "slack", "teams"]) }).strict().parse(raw);
      result = await testNotification(actor, input.adapter);
    } else {
      assertPermission(actor.role, "write");
      const data = createCampaignSchema.parse(raw);
      result = await createCampaign(actor, data);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const raw = await readJson(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    let result: unknown;

    if (action === "channel") {
      const input = z.object({ campaignId: z.string(), channelId: z.string(), data: updateChannelSchema }).strict().parse(raw);
      result = await updateChannel(actor, input.campaignId, input.channelId, input.data);
    } else if (action === "checklist-item") {
      const input = z.object({ campaignId: z.string(), itemId: z.string(), patch: z.object({ status: z.enum(["pending", "approved", "blocked", "warning"]).optional(), severity: z.enum(["info", "warning", "blocker"]).optional(), details: z.string().optional() }).partial() }).strict().parse(raw);
      result = await updateChecklistItem(actor, input.campaignId, input.itemId, input.patch);
    } else if (action === "incident-confirm") {
      const input = z.object({ incidentId: z.string() }).strict().parse(raw);
      result = await confirmIncident(actor, input.incidentId);
    } else if (action === "incident-recover") {
      const input = z.object({ incidentId: z.string() }).strict().parse(raw);
      result = await recoverIncident(actor, input.incidentId);
    } else {
      const input = z.object({ id: z.string(), data: updateCampaignSchema }).strict().parse(raw);
      result = await updateCampaign(actor, input.id, input.data);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `workspace:${actor.workspaceId}:${actor.userId}`);
    const raw = await readJson(request);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    let result: unknown;

    if (action === "channel") {
      const input = z.object({ campaignId: z.string(), channelId: z.string() }).strict().parse(raw);
      result = await deleteChannel(actor, input.campaignId, input.channelId);
    } else {
      const { id } = z.object({ id: z.string() }).strict().parse(raw);
      result = await deleteCampaign(actor, id);
    }
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return failure(error); }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

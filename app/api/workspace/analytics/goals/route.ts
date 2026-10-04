import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import {
  analyticsGoalInputSchema,
  createAnalyticsGoal,
  listGoalScopeOptions,
  listAnalyticsGoals,
  setAnalyticsGoalPrimary,
  updateAnalyticsGoalStatus,
} from "@/modules/analytics/goals";
import { track } from "@/lib/analytics";
import { requireActor } from "@/modules/workspaces/context";

const deleteSchema = z.object({ id: z.string().min(1).max(255) }).strict();
const patchSchema = z
  .object({
    id: z.string().min(1).max(255),
    status: z.enum(["ACTIVE", "PAUSED", "ARCHIVED"]).optional(),
    isPrimary: z.boolean().optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.status === undefined && input.isPrimary === undefined)
      context.addIssue({ code: "custom", message: "Nenhuma alteração foi informada." });
    if (input.status !== undefined && input.isPrimary !== undefined)
      context.addIssue({ code: "custom", message: "Envie uma alteração por vez." });
  });

export async function GET(request: Request) {
  try {
    const actor = await requireActor(request);
    const view = new URL(request.url).searchParams.get("view");
    if (view === "options")
      return NextResponse.json(await listGoalScopeOptions(actor), {
        headers: { "Cache-Control": "private, no-store" },
      });
    void track("goal_viewed", { workspaceId: actor.workspaceId });
    return NextResponse.json(await listAnalyticsGoals(actor), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireActor(request);
    return NextResponse.json(
      await createAnalyticsGoal(actor, analyticsGoalInputSchema.parse(await readJson(request))),
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const actor = await requireActor(request);
    await updateAnalyticsGoalStatus(
      actor,
      deleteSchema.parse(await readJson(request)).id,
      "ARCHIVED",
    );
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const actor = await requireActor(request);
    const input = patchSchema.parse(await readJson(request));
    const goal =
      input.status !== undefined
        ? await updateAnalyticsGoalStatus(actor, input.id, input.status)
        : await setAnalyticsGoalPrimary(actor, input.id, input.isPrimary ?? false);
    return NextResponse.json(goal, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
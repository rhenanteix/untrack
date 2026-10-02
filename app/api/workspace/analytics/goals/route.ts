import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import {
  analyticsGoalInputSchema,
  createAnalyticsGoal,
  deleteAnalyticsGoal,
  listAnalyticsGoals,
} from "@/modules/analytics/goals";
import { requireActor } from "@/modules/workspaces/context";

const deleteSchema = z.object({ id: z.string().min(1).max(255) }).strict();

export async function GET(request: Request) {
  try {
    return NextResponse.json(await listAnalyticsGoals(await requireActor(request)), {
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
    await deleteAnalyticsGoal(actor, deleteSchema.parse(await readJson(request)).id);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
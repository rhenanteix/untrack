import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  issueSmartCardWalletPass,
  revokeSmartCardWalletPass,
  smartCardWalletStatus,
} from "@/modules/smart-cards/wallet";
import { requireActor } from "@/modules/workspaces/context";

type Context = { params: Promise<{ id: string }> };

const providerSchema = z.object({ provider: z.enum(["apple", "google"]) });

export async function GET(request: Request, context: Context) {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return NextResponse.json(await smartCardWalletStatus(actor, id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    const headers = await enforceRateLimit(
      request,
      `smart-card-wallet:${actor.userId}`,
    );
    const { id } = await context.params;
    const { provider } = providerSchema.parse(await readJson(request));
    return NextResponse.json(
      await issueSmartCardWalletPass(actor, id, provider),
      { headers },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    enforceSameOrigin(request);
    const actor = await requireActor(request);
    await enforceRateLimit(request, `smart-card-wallet:${actor.userId}`);
    const { id } = await context.params;
    const { provider } = providerSchema.parse(await readJson(request));
    await revokeSmartCardWalletPass(actor, id, provider);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return errorResponse(error);
  }
}
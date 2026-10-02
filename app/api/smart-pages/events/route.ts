import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  publicSmartPageEventNames,
  recordPublicSmartPageEvent,
} from "@/modules/smart-pages/events";
import { smartPageSlugSchema } from "@/modules/smart-pages/schemas";

const inputSchema = z
  .object({
    event: z.enum(publicSmartPageEventNames),
    slug: smartPageSlugSchema,
    eventId: z.string().uuid(),
    visitorId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    blockId: z.string().min(1).max(200).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      [
        "smart_block_view",
        "smart_block_clicked",
        "link_in_bio_product_view",
        "link_in_bio_product_click",
      ].includes(value.event) &&
      !value.blockId
    ) {
      context.addIssue({
        code: "custom",
        path: ["blockId"],
        message: "Informe o bloco do evento.",
      });
    }
  });

export async function POST(request: Request) {
  try {
    enforceSameOrigin(request);
    const headers = await enforceRateLimit(request, "smart-page-events");
    await recordPublicSmartPageEvent(
      inputSchema.parse(await readJson(request)),
      request.headers,
    );
    return new NextResponse(null, { status: 204, headers });
  } catch (error) {
    return errorResponse(error);
  }
}

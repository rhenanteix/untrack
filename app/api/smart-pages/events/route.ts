import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import {
  publicSmartPageEventNames,
  recordPublicSmartPageEvent,
} from "@/modules/smart-pages/events";
import { reportAnalyticsHealth } from "@/modules/analytics/health";
import { smartPageSlugSchema } from "@/modules/smart-pages/schemas";

const inputSchema = z
  .object({
    event: z.enum(publicSmartPageEventNames),
    slug: smartPageSlugSchema,
    eventId: z.string().uuid(),
    visitorId: z.string().uuid().optional(),
    sessionId: z.string().uuid().optional(),
    blockId: z.string().min(1).max(200).optional(),
    utmSource: z.string().trim().max(120).optional(),
    utmMedium: z.string().trim().max(120).optional(),
    utmCampaign: z.string().trim().max(120).optional(),
    utmContent: z.string().trim().max(120).optional(),
    utmTerm: z.string().trim().max(120).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      [
        "smart_block_view",
        "form_view",
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
    const rateHeaders = await enforceRateLimit(request, "smart-page-events");
    const result = await recordPublicSmartPageEvent(
      inputSchema.parse(await readJson(request)),
      request.headers,
    );
    const response = new NextResponse(null, {
      status: 204,
      headers: rateHeaders,
    });
    for (const cookie of result.cookieHeaders)
      response.headers.append("Set-Cookie", cookie);
    return response;
  } catch (error) {
    reportAnalyticsHealth("events_rejected");
    return errorResponse(error);
  }
}

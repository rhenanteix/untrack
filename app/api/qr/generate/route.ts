import { withAnonymousUse } from "@/lib/anonymous-use";
import { after, NextResponse } from "next/server";
import { errorResponse, readJson } from "@/lib/api-response";
import { track } from "@/lib/analytics";
import { enforceRateLimit } from "@/lib/rate-limit";
import { qrInputSchema } from "@/modules/qr-code/qr.schemas";
import { renderQrDataUrl, renderQrPng } from "@/modules/qr-code/qr.service";
import { saveCloudHistory } from "@/lib/cloud-history";

export const runtime = "nodejs";

async function handlePost(request: Request) {
  try {
    const rateHeaders = await enforceRateLimit(request, "qr");
    const input = qrInputSchema.parse(await readJson(request));
    const recordGeneration = () =>
      track("qr_generated", { format: input.format, width: input.width });

    if (input.format === "png") {
      const png = await renderQrPng(input);
      await saveCloudHistory(request, input.url, input.url, "qr");
      after(recordGeneration);
      return new NextResponse(png, {
        headers: {
          ...rateHeaders,
          "Content-Type": "image/png",
          "Content-Disposition": 'inline; filename="qrcode.png"',
          "Cache-Control": "no-store",
        },
      });
    }

    const dataUrl = await renderQrDataUrl(input);
    const historySaved = await saveCloudHistory(
      request,
      input.url,
      input.url,
      "qr",
    );
    after(recordGeneration);
    return NextResponse.json(
      { dataUrl, historySaved },
      { headers: rateHeaders },
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) { return withAnonymousUse(request, () => handlePost(request)); }

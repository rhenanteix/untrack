import { errorResponse } from "@/lib/api-response";
import { publicSmartCardQr } from "@/modules/smart-cards/service";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const qr = await publicSmartCardQr(slug);
    return new Response(Uint8Array.from(qr.bytes), {
      headers: {
        "Content-Type": qr.contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
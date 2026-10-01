import { errorResponse } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { redirectResponse } from "@/modules/link-management/redirect";

type Context = { params: Promise<{ slug: string }> };

async function resolve(request: Request, context: Context, countClick: boolean) {
  try {
    if (countClick) await enforceRateLimit(request, "whatsapp-redirect");
    return await redirectResponse(
      request,
      (await context.params).slug,
      "whatsapp",
      countClick,
      "Não foi possível continuar. Este link do WhatsApp está indisponível.",
    );
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = (request: Request, context: Context) => resolve(request, context, true);
export const HEAD = (request: Request, context: Context) => resolve(request, context, false);
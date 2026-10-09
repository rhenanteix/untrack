import { enforceRateLimit } from "@/lib/rate-limit";
import { ApiError } from "@/lib/api-response";
import { publicRequestSource } from "@/modules/connect/sources";
import { connectError, receiveEvent } from "@/modules/connect/http";

type Context = { params: Promise<{ sourceId: string }> };
function cors(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, DNT, Sec-GPC",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}
export async function OPTIONS(request: Request, context: Context) {
  try {
    await enforceRateLimit(request, "connect-public");
    const { sourceId } = await context.params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sourceId))
      throw new ApiError(403, "SOURCE_FORBIDDEN", "Fonte inválida.");
    const origin = request.headers.get("origin");
    await publicRequestSource(sourceId, origin);
    return new Response(null, { status: 204, headers: cors(origin!) });
  } catch (error) {
    return connectError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    await enforceRateLimit(request, "connect-public");
    const { sourceId } = await context.params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(sourceId))
      throw new ApiError(403, "SOURCE_FORBIDDEN", "Fonte inválida.");
    const origin = request.headers.get("origin");
    const source = await publicRequestSource(sourceId, origin);
    return await receiveEvent(request, source, cors(origin!));
  } catch (error) {
    return connectError(error);
  }
}

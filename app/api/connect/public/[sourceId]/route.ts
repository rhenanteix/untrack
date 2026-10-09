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
    const { sourceId } = await context.params;
    const origin = request.headers.get("origin");
    await publicRequestSource(sourceId, origin);
    return new Response(null, { status: 204, headers: cors(origin!) });
  } catch (error) {
    return connectError(error);
  }
}
export async function POST(request: Request, context: Context) {
  try {
    const { sourceId } = await context.params;
    const origin = request.headers.get("origin");
    const source = await publicRequestSource(sourceId, origin);
    return await receiveEvent(request, source, cors(origin!));
  } catch (error) {
    return connectError(error);
  }
}

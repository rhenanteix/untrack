import { redirectResponse } from "@/modules/link-management/redirect";
import { errorResponse } from "@/lib/api-response";
type Context = { params: Promise<{ slug: string }> };
async function resolve(request: Request, context: Context, countClick: boolean) {
  try { return await redirectResponse(request, (await context.params).slug, "qr", countClick); }
  catch (error) { return errorResponse(error); }
}
export const GET = (request: Request, context: Context) => resolve(request, context, true);
export const HEAD = (request: Request, context: Context) => resolve(request, context, false);

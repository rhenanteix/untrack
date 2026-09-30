import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/api-response";

export const runtime = "nodejs";

async function handle(request: Request) {
  try {
    return await getAuth().handler(request);
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = handle;
export const POST = handle;

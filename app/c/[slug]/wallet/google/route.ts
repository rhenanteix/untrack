import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api-response";
import { publicGoogleWalletSaveUrl } from "@/modules/smart-cards/wallet";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    return NextResponse.redirect(await publicGoogleWalletSaveUrl(slug));
  } catch (error) {
    return errorResponse(error);
  }
}
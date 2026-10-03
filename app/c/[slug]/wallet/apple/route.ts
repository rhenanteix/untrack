import { errorResponse } from "@/lib/api-response";
import { publicAppleWalletPass } from "@/modules/smart-cards/wallet";

type Context = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const { slug } = await context.params;
    const pass = await publicAppleWalletPass(slug);
    return new Response(Uint8Array.from(pass), {
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${slug}.pkpass"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
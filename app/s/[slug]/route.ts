import { NextResponse } from "next/server";
import { publicLink } from "@/lib/short-links";
import { getPrisma } from "@/lib/prisma";
import { clickMetadata } from "@/modules/short-links/click-metadata";
import { errorResponse } from "@/lib/api-response";

type Context = { params: Promise<{ slug: string }> };

async function resolve(
  request: Request,
  context: Context,
  countClick: boolean,
) {
  try {
    const { slug } = await context.params;
    const link = await publicLink(slug);
    if (!link)
      return new NextResponse("Link não encontrado ou desativado.", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const metadata = countClick ? clickMetadata(request.headers) : null;
    if (metadata) {
      try {
        await getPrisma().linkClick.create({
          data: { linkId: link.id, ...metadata },
        });
      } catch {
        console.error("Não foi possível registrar uma visita ao link.");
      }
    }
    return new NextResponse(null, {
      status: 302,
      headers: {
        Location: link.destinationUrl,
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export const GET = (request: Request, context: Context) =>
  resolve(request, context, true);
export const HEAD = (request: Request, context: Context) =>
  resolve(request, context, false);

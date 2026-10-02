import { NextResponse } from "next/server";
import { publicSmartCard } from "@/modules/smart-cards/service";
import { smartCardSlugSchema } from "@/modules/smart-cards/schemas";

type Context = { params: Promise<{ slug: string }> };

function escapeVcard(value: string) {
  return value.replace(/([\\,;\n\r])/g, "\\$1");
}

export async function GET(_request: Request, context: Context) {
  const { slug } = await context.params;
  const card = await publicSmartCard(smartCardSlugSchema.parse(slug));
  if (!card) return new NextResponse(null, { status: 404 });
  const name = [card.lastName, card.firstName].map(escapeVcard).join(";");
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${name};;;`,
    `FN:${escapeVcard(`${card.firstName} ${card.lastName}`.trim())}`,
    card.company ? `ORG:${escapeVcard(card.company)}` : null,
    card.headline ? `TITLE:${escapeVcard(card.headline)}` : null,
    card.phone ? `TEL;TYPE=CELL:${escapeVcard(card.phone)}` : null,
    card.email ? `EMAIL;TYPE=INTERNET:${escapeVcard(card.email)}` : null,
    card.websiteUrl ? `URL:${escapeVcard(card.websiteUrl)}` : null,
    "END:VCARD",
  ].filter(Boolean);
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/vcard; charset=utf-8",
      "Content-Disposition": `attachment; filename="${card.slug}.vcf"`,
      "Cache-Control": "private, no-store",
    },
  });
}

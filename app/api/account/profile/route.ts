import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireUser } from "@/lib/session";
import { webUrlSchema } from "@/modules/validation/url-validation";

const profileSchema = z
  .object({
    name: z.string().trim().min(1, "Informe seu nome.").max(120),
    image: webUrlSchema.nullable().optional(),
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `account-profile:${user.id}`);
    const input = profileSchema.parse(await readJson(request));
    const updated = await getPrisma().user.update({
      where: { id: user.id },
      data: input,
      select: { name: true, email: true, image: true },
    });
    return NextResponse.json(updated, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
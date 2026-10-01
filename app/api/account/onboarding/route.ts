import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, readJson } from "@/lib/api-response";
import { getPrisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { enforceSameOrigin } from "@/lib/request-origin";
import { requireUser } from "@/lib/session";
import { socialLinksSchema } from "@/modules/smart-pages/schemas";

const onboardingSchema = z
  .object({
    goal: z.enum(["creator", "business", "personal", "professional"]),
    socialLinks: socialLinksSchema,
  })
  .strict();

export async function PATCH(request: Request) {
  try {
    enforceSameOrigin(request);
    const user = await requireUser(request);
    await enforceRateLimit(request, `onboarding:${user.id}`);
    const input = onboardingSchema.parse(await readJson(request));
    await getPrisma().user.update({
      where: { id: user.id },
      data: {
        onboarding: {
          version: 1,
          completedAt: new Date().toISOString(),
          ...input,
        },
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
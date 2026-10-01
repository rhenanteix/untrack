import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { getPrisma } from "@/lib/prisma";
import { shortLinkInputSchema } from "./schemas";

const guestUserId = "untrack-guest-user";
const guestWorkspaceId = "untrack-guest-workspace";

function assertGuestDestination(url: string) {
  const parsed = new URL(url);
  if (
    parsed.origin === appUrl().origin &&
    /^\/(s|l|q)\//.test(parsed.pathname)
  ) {
    throw new ApiError(
      400,
      "NESTED_SHORT_LINK",
      "Use o destino original, não outro redirect da aplicação.",
    );
  }
}

async function ensureGuestWorkspace() {
  const prisma = getPrisma();
  await prisma.$transaction(async (tx) => {
    await tx.user.upsert({
      where: { id: guestUserId },
      create: {
        id: guestUserId,
        name: "Untrack Guest",
        email: "guest-links@untrack.invalid",
      },
      update: {},
    });
    await tx.workspace.upsert({
      where: { id: guestWorkspaceId },
      create: { id: guestWorkspaceId, name: "Untrack Guest Links" },
      update: {},
    });
    await tx.workspaceMember.upsert({
      where: {
        workspaceId_userId: {
          workspaceId: guestWorkspaceId,
          userId: guestUserId,
        },
      },
      create: {
        workspaceId: guestWorkspaceId,
        userId: guestUserId,
        role: "owner",
      },
      update: {},
    });
  });
}

export async function createGuestShortLink(raw: unknown) {
  const input = shortLinkInputSchema.parse(raw);
  assertGuestDestination(input.url);
  await ensureGuestWorkspace();

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await getPrisma().shortLink.create({
        data: {
          userId: guestUserId,
          workspaceId: guestWorkspaceId,
          slug: randomBytes(8).toString("base64url").slice(0, 10),
          destinationUrl: input.url,
          title: input.title,
          description: input.description,
        },
      });
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )) {
        throw error;
      }
    }
  }
  throw new ApiError(
    409,
    "SLUG_COLLISION",
    "Não foi possível gerar um slug. Tente novamente.",
  );
}

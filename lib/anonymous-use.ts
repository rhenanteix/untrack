import { createHmac, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { sessionFromHeaders } from "@/lib/session";
import { ApiError, errorResponse } from "@/lib/api-response";
const cookieName = "untrack.guest";
/** One successful anonymous operation across all tools. Database uniqueness arbitrates races. */
export async function withAnonymousUse(
  request: Request,
  action: () => Promise<Response>,
): Promise<Response> {
  try {
    if (await sessionFromHeaders(request.headers)) return action();
    const secret = process.env.BETTER_AUTH_SECRET;
    if (!secret || secret.length < 32)
      throw new ApiError(
        503,
        "GUEST_UNAVAILABLE",
        "O uso gratuito está indisponível no momento. Tente novamente mais tarde.",
      );
    // Same trusted proxy headers used by authentication and rate limiting. Deployment must strip client-supplied values.
    const ip =
      request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip")?.trim() ||
      (process.env.NODE_ENV !== "production" ? "local-development" : null);
    if (!ip)
      throw new ApiError(
        503,
        "GUEST_UNAVAILABLE",
        "Não foi possível validar o acesso gratuito. Entre na sua conta para continuar.",
      );
    const raw = request.headers
      .get("cookie")
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    const visitor = raw && /^[a-f0-9-]{36}$/.test(raw) ? raw : randomUUID();
    const keys = [`visitor:${visitor}`, `network:${ip}`].map((value) =>
      createHmac("sha256", secret).update(`guest-v1:${value}`).digest("hex"),
    );
    try {
      await getPrisma().anonymousUse.createMany({
        data: keys.map((keyHash) => ({ keyHash })),
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )
        throw new ApiError(
          401,
          "LOGIN_REQUIRED",
          "Seu uso gratuito já foi utilizado. Entre ou crie uma conta para trabalhar com mais links.",
        );
      throw error;
    }
    let response: Response;
    try {
      response = await action();
    } catch (error) {
      await getPrisma().anonymousUse.deleteMany({
        where: { keyHash: { in: keys } },
      });
      throw error;
    }
    if (response.status >= 400) {
      await getPrisma().anonymousUse.deleteMany({
        where: { keyHash: { in: keys } },
      });
      return response;
    }
    const result = new NextResponse(response.body, {
      status: response.status,
      headers: response.headers,
    });
    result.cookies.set(cookieName, visitor, {
      httpOnly: true,
      sameSite: "lax",
      secure: new URL(request.url).protocol === "https:",
      path: "/",
      maxAge: 31536000,
    });
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  } catch (error) {
    return errorResponse(error);
  }
}

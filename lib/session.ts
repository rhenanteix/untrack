import { getAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api-response";

export async function sessionFromHeaders(headers: Headers) {
  // Keep the anonymous V1 tools independent of the database.
  if (!headers.get("cookie")?.includes("arrume.session_token=")) return null;
  return getAuth().api.getSession({ headers });
}

export async function requireUser(request: Request) {
  const session = await sessionFromHeaders(request.headers);
  if (!session)
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Entre na sua conta para continuar.",
    );
  return session.user;
}

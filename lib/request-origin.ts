import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== appUrl().origin)
  ) {
    throw new ApiError(
      403,
      "INVALID_ORIGIN",
      "Origem da solicitação não permitida.",
    );
  }
}

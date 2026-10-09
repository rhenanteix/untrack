import { randomUUID, timingSafeEqual } from "node:crypto";
import { ZodError } from "zod";
import { ApiError } from "@/lib/api-response";
import { enforceRateLimit } from "@/lib/rate-limit";
import { ingestEvent } from "./ingestion";
import type { ConnectSource } from "@prisma/client";
import { connectLog } from "./telemetry";

export function operationalAuth(request: Request, kind: "worker" | "admin") {
  if (request.headers.has("origin") || request.headers.has("sec-fetch-site"))
    throw new ApiError(
      403,
      "SERVER_ONLY",
      "Acesso operacional restrito ao servidor.",
    );
  const secret =
    process.env[
      kind === "worker" ? "CONNECT_WORKER_SECRET" : "CONNECT_ADMIN_SECRET"
    ];
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (
    !secret ||
    secret.length < 32 ||
    actual.length !== expected.length ||
    !timingSafeEqual(actual, expected)
  )
    throw new ApiError(
      401,
      "UNAUTHORIZED",
      "Acesso operacional não autorizado.",
    );
}

export function connectError(
  error: unknown,
  correlationId = randomUUID(),
  headers: Record<string, string> = {},
) {
  const status =
    error instanceof ApiError
      ? error.status
      : error instanceof ZodError
        ? 400
        : 503;
  const code =
    error instanceof ApiError
      ? error.code
      : error instanceof ZodError
        ? "INVALID_INPUT"
        : "CONNECT_UNAVAILABLE";
  connectLog("request_failed", { correlationId, code });
  return Response.json(
    {
      code,
      correlationId,
      error:
        status >= 500
          ? "Ingestão indisponível. Reenvie o evento com o mesmo identificador."
          : "Solicitação não aceita.",
    },
    {
      status,
      headers: {
        ...headers,
        "Cache-Control": "no-store",
        "X-Correlation-ID": correlationId,
        ...(status >= 500 ? { "Retry-After": "5" } : {}),
      },
    },
  );
}

export async function receiveEvent(
  request: Request,
  source: ConnectSource,
  headers: Record<string, string> = {},
) {
  const correlationId = randomUUID();
  try {
    const rateHeaders = await enforceRateLimit(request, `connect:${source.id}`);
    const raw = await readEventJson(request);
    const result = await ingestEvent(source, raw, {
      correlationId,
      privacyDenied:
        request.headers.get("dnt") === "1" ||
        request.headers.get("sec-gpc") === "1",
    });
    const status = result.conflict
      ? 409
      : result.state === "rejected"
        ? 422
        : result.duplicate
          ? 200
          : 202;
    return Response.json(result, {
      status,
      headers: {
        ...rateHeaders,
        ...headers,
        "Cache-Control": "no-store",
        "X-Correlation-ID": correlationId,
      },
    });
  } catch (error) {
    return connectError(error, correlationId, headers);
  }
}

/** Bound bytes while streaming, including requests without Content-Length. */
async function readEventJson(request: Request) {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "JSON required");
  const max = 16_384;
  if (Number(request.headers.get("content-length")) > max)
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload too large");
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError(400, "INVALID_JSON", "JSON required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) {
        await reader.cancel();
        throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new ApiError(400, "INVALID_JSON", "Invalid JSON");
  }
}

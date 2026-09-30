import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function errorResponse(
  error: unknown,
  additionalBody: Record<string, unknown> = {},
): NextResponse {
  if (error instanceof ZodError) {
    const message = "Verifique os dados informados.";
    return NextResponse.json(
      {
        ...additionalBody,
        error: message,
        code: "INVALID_INPUT",
        fields: error.issues.map(({ path, message: fieldMessage }) => ({
          field: path.join("."),
          message: fieldMessage,
        })),
      },
      { status: 400 },
    );
  }

  if (error instanceof ApiError) {
    return NextResponse.json(
      { ...additionalBody, error: error.message, code: error.code },
      { status: error.status },
    );
  }

  console.error("Unhandled API error", error);
  return NextResponse.json(
    {
      ...additionalBody,
      error: "Não foi possível concluir a solicitação.",
      code: "INTERNAL_ERROR",
    },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Envie os dados como JSON.",
    );
  }

  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "INVALID_JSON", "O JSON enviado é inválido.");
  }
}

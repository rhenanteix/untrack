export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly fields: { field: string; message: string }[] = [],
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

export async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { "Content-Type": "application/json", ...options?.headers },
    });
  } catch {
    throw new Error("Falha de conexão. Tente novamente.");
  }
  if (response.status === 204) return undefined as T;
  const body = await response.json();
  if (!response.ok) {
    if (response.status === 401)
      throw new Error("Sua sessão expirou. Entre novamente na sua conta.");
    const fields = Array.isArray(body.fields)
      ? body.fields.filter(
          (item: { field?: unknown; message?: unknown }) =>
            typeof item.field === "string" && typeof item.message === "string",
        )
      : [];
    throw new ApiRequestError(
      body.error ?? "Não foi possível concluir a solicitação.",
      body.code ?? "REQUEST_FAILED",
      fields,
    );
  }
  return body as T;
}

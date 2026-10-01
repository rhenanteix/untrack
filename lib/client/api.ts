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
    const details = Array.isArray(body.fields)
      ? body.fields
          .map(
            (item: { field?: string; message?: string }) =>
              `${item.field ? `${item.field}: ` : ""}${item.message ?? "Valor inválido"}`,
          )
          .join(" ")
      : "";
    throw new Error(
      [body.error ?? "Não foi possível concluir a solicitação.", details]
        .filter(Boolean)
        .join(" "),
    );
  }
  return body as T;
}

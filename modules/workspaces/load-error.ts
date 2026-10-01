import { ApiError } from "@/lib/api-response";
export function workspaceLoadError(error: unknown): {
  title: string;
  message: string;
  code: string;
} {
  if (
    error instanceof ApiError &&
    ["WORKSPACE_FORBIDDEN", "INVALID_WORKSPACE"].includes(error.code)
  )
    return {
      title: "Selecione outro workspace",
      message:
        "O workspace selecionado não está disponível para sua conta. Use o seletor ao lado para continuar.",
      code: error.code,
    };
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code)
      : "UNKNOWN";
  if (["P2021", "P2022"].includes(code))
    return {
      title: "Este módulo precisa de uma atualização",
      message:
        "A atualização do banco ainda não foi concluída neste ambiente. Avise o responsável pela aplicação e tente novamente após a atualização.",
      code: "DATABASE_SCHEMA_OUTDATED",
    };
  if (["P1000", "P1001", "P1002", "P1017"].includes(code))
    return {
      title: "Não foi possível conectar ao workspace",
      message:
        "O banco de dados está indisponível neste momento. Seus dados não foram alterados. Tente novamente em instantes.",
      code: "DATABASE_UNAVAILABLE",
    };
  return {
    title: "Não foi possível abrir este módulo",
    message:
      "Tente carregar novamente. Se o problema continuar, informe o código abaixo ao responsável pela aplicação.",
    code: "WORKSPACE_LOAD_FAILED",
  };
}

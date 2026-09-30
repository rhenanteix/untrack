import { POST as analyze } from "../analyze/route";

/**
 * Alias de `POST /api/links/analyze`. A análise já devolve a URL limpa, então
 * as duas rotas compartilham o mesmo handler — e, principalmente, o mesmo
 * bucket de rate limit.
 */
export const POST = analyze;

import { resolveTxt, resolveCname, lookup } from "node:dns/promises";
import https from "node:https";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { domainToASCII } from "node:url";
import { getPrisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-response";
import { appUrl } from "@/lib/app-url";
import { isPublicAddress } from "@/modules/link-analyzer/network";
import { audit, reserveQuota, workspaceTransaction, type Actor } from "@/modules/workspaces/context";
export const domainSchema = z.object({ hostname: z.string().trim().toLowerCase().transform(domainToASCII).refine((value) => value.length <= 253 && /^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(value), "Informe um hostname DNS válido.") }).strict();
export async function createDomain(actor: Actor, raw: unknown) {
  const input = domainSchema.parse(raw);
  if (input.hostname === appUrl().hostname) throw new ApiError(400, "RESERVED_DOMAIN", "O domínio da aplicação já é gerenciado pela plataforma.");
  return workspaceTransaction(actor, "manage", async (tx, access) => {
    if (await tx.customDomain.findUnique({ where: { hostname: input.hostname } })) throw new ApiError(409, "DOMAIN_EXISTS", "Domínio já associado a um workspace.");
    await reserveQuota(tx, actor.workspaceId, access, "domains");
    const domain = await tx.customDomain.create({ data: { workspaceId: actor.workspaceId, hostname: input.hostname, token: randomBytes(24).toString("hex") } });
    await audit(tx, actor, "domain.created", domain.id, { hostname: domain.hostname });
    return domain;
  });
}
async function probeHttps(hostname: string, token: string, signal: AbortSignal) {
  const addresses = await lookup(hostname, { all: true });
  signal.throwIfAborted();
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new Error("DNS aponta para endereço não público.");
  const selected = addresses[0];
  return new Promise<void>((resolve, reject) => {
    const request = https.request({ hostname, family: selected.family, method: "HEAD", path: "/.well-known/untrack-domain", agent: false, signal, maxHeaderSize: 4096, lookup: (_name, _options, callback) => callback(null, selected.address, selected.family) }, (response) => {
      const ok = response.statusCode === 200 && response.headers["x-untrack-domain"] === token;
      response.destroy();
      if (ok) resolve(); else reject(new Error("HTTPS ainda não serve a rota de verificação do Untrack."));
    });
    request.on("error", reject); request.end();
  });
}
export async function verifyDomain(actor: Actor, id: string) {
  // Permission checked before outbound work and again under transaction before changing state.
  const { assertPermission } = await import("@/modules/workspaces/policy");
  assertPermission(actor.role, "manage");
  const domain = await getPrisma().customDomain.findFirst({ where: { id, workspaceId: actor.workspaceId } });
  if (!domain) throw new ApiError(404, "DOMAIN_NOT_FOUND", "Domínio não encontrado.");
  const expected = process.env.SHORT_LINKS_CNAME?.toLowerCase().replace(/\.$/, "");
  let status = "pending_dns", lastError: string | null = null;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([(async () => {
      if (!expected) throw new Error("Configure SHORT_LINKS_CNAME e o hostname/certificado no provedor de hospedagem.");
      const [txt, cname] = await Promise.all([resolveTxt(`_untrack.${domain.hostname}`), resolveCname(domain.hostname)]);
      controller.signal.throwIfAborted();
      if (!txt.some((chunks) => chunks.join("") === `untrack-verification=${domain.token}`)) throw new Error("TXT de posse não confirmado.");
      if (!cname.some((name) => name.toLowerCase().replace(/\.$/, "") === expected)) throw new Error("CNAME ainda não aponta para o destino configurado.");
      status = "pending_https";
      await probeHttps(domain.hostname, domain.token, controller.signal);
      controller.signal.throwIfAborted();
      status = "active";
    })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("Timeout na verificação DNS/HTTPS.")); }, 10000); })]);
  } catch (error) { lastError = error instanceof Error ? error.message : "Falha na verificação."; }
  finally { clearTimeout(timer); }
  return workspaceTransaction(actor, "manage", async (tx) => {
    const updated = await tx.customDomain.update({ where: { id }, data: { status, lastError, checkedAt: new Date(), verifiedAt: status === "active" ? new Date() : null } });
    await audit(tx, actor, "domain.checked", id, { status, lastError });
    return updated;
  });
}

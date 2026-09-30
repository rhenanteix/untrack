import { z } from "zod";
import { webUrlSchema } from "@/modules/validation/url-validation";
export const UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"] as const;
export const fieldSchema = z.enum(UTM_FIELDS);
export type UtmField = typeof UTM_FIELDS[number];
const valuesSchema = z.object(Object.fromEntries(UTM_FIELDS.map((key) => [key, z.string().max(200).optional()])) as Record<UtmField, z.ZodOptional<z.ZodString>>).strict();
const fieldRule = z.object({ required: z.boolean().default(false), lowercase: z.boolean().default(false), allowed: z.array(z.string().max(200)).max(100).default([]), forbidden: z.array(z.string().max(200)).max(100).default([]), pattern: z.enum(["any", "snake_case", "kebab-case"]).default("any"), severity: z.enum(["error", "warning"]).default("error") }).strict();
export const governanceSchema = z.object({ fields: z.partialRecord(fieldSchema, fieldRule).default({}), conditions: z.array(z.object({ field: fieldSchema, equals: z.string().max(200), channel: z.enum(["any", "paid", "organic"]).default("any"), target: fieldSchema, value: z.string().min(1).max(200), severity: z.enum(["error", "warning"]).default("error") }).strict()).max(30).default([]) }).strict();
export type Governance = z.infer<typeof governanceSchema>;
export const builderSchema = z.object({ url: webUrlSchema, fields: valuesSchema, custom: z.array(z.object({ key: z.string().min(1).max(100), value: z.string().max(1000) }).strict()).max(30).default([]), conflicts: z.record(z.string(), z.enum(["keep", "replace"])).default({}), channel: z.enum(["paid", "organic"]).default("organic") }).strict();
export type BuilderInput = z.infer<typeof builderSchema>;
export interface UtmMessage { field: string; message: string }
export function governanceConflicts(governance: Governance): string[] {
  const errors: string[] = [];
  for (const [field, rule] of Object.entries(governance.fields)) {
    if (!rule) continue;
    if (rule.allowed.some((value) => rule.forbidden.includes(value))) errors.push(`${field}: valores permitidos e proibidos se sobrepõem.`);
    if (rule.lowercase && rule.allowed.some((value) => value !== value.toLowerCase())) errors.push(`${field}: valores permitidos conflitam com lowercase.`);
    if (rule.pattern !== "any" && rule.allowed.some((value) => !(rule.pattern === "snake_case" ? /^[a-z0-9]+(?:_[a-z0-9]+)*$/ : /^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(value))) errors.push(`${field}: valores permitidos conflitam com o padrão.`);
  }
  for (const rule of governance.conditions) {
    const target = governance.fields[rule.target];
    if (target && (target.forbidden.includes(rule.value) || (target.allowed.length && !target.allowed.includes(rule.value)) || (target.lowercase && rule.value !== rule.value.toLowerCase()))) errors.push(`Condição para ${rule.target} contradiz as regras desse campo.`);
    if (governance.conditions.some((other) => other !== rule && other.field === rule.field && other.equals === rule.equals && (other.channel === rule.channel || other.channel === "any" || rule.channel === "any") && other.target === rule.target && other.value !== rule.value)) errors.push(`Condições conflitantes para ${rule.target}.`);
  }
  return [...new Set(errors)];
}
export function buildGovernedUrl(raw: unknown, rawGovernance: unknown = {}) {
  const input = builderSchema.parse(raw);
  const governance = governanceSchema.parse(rawGovernance);
  const errors: UtmMessage[] = governanceConflicts(governance).map((message) => ({ field: "governance", message }));
  const warnings: UtmMessage[] = [];
  const corrections: UtmMessage[] = [];
  const conflicts: Array<{ key: string; existing: string[]; proposed: string }> = [];
  const url = new URL(input.url);
  const proposed = new Map<string, string>();
  for (const field of UTM_FIELDS) if (input.fields[field] !== undefined) proposed.set(field, input.fields[field]!);
  for (const { key, value } of input.custom) {
    if (UTM_FIELDS.includes(key as UtmField) || proposed.has(key)) errors.push({ field: key, message: "Chave personalizada duplicada ou reservada para UTM." });
    else proposed.set(key, value);
  }
  for (const [key, rawValue] of proposed) {
    const existing = url.searchParams.getAll(key);
    const choice = input.conflicts[key];
    if (existing.length && (existing.length !== 1 || existing[0] !== rawValue)) {
      conflicts.push({ key, existing, proposed: rawValue });
      if (!choice) { errors.push({ field: key, message: "Parâmetro existente: escolha manter ou substituir." }); continue; }
      if (choice === "keep") continue;
    }
    url.searchParams.set(key, rawValue);
  }
  // Governance validates the final values, including values explicitly kept.
  for (const field of UTM_FIELDS) {
    const rule = governance.fields[field];
    if (!rule) continue;
    const values = url.searchParams.getAll(field);
    if (values.length > 1) { errors.push({ field, message: "UTM duplicada na URL original; escolha substituir por um único valor." }); continue; }
    let value = values[0] ?? "";
    if (rule.lowercase && value !== value.toLowerCase()) {
      if (input.conflicts[field] === "keep") errors.push({ field, message: "Manter o valor original conflita com a regra lowercase. Substitua explicitamente." });
      else { value = value.toLowerCase(); url.searchParams.set(field, value); corrections.push({ field, message: "Valor convertido para lowercase conforme governança; URL e demais campos preservados." }); }
    }
    const target = rule.severity === "error" ? errors : warnings;
    if (rule.required && !value) target.push({ field, message: "Campo obrigatório pela governança." });
    if (!value) continue;
    if (rule.allowed.length && !rule.allowed.includes(value)) target.push({ field, message: "Valor fora da lista permitida." });
    if (rule.forbidden.includes(value)) target.push({ field, message: "Valor proibido pela governança." });
    if (rule.pattern !== "any" && !(rule.pattern === "snake_case" ? /^[a-z0-9]+(?:_[a-z0-9]+)*$/ : /^[a-z0-9]+(?:-[a-z0-9]+)*$/).test(value)) target.push({ field, message: `Use o padrão ${rule.pattern}.` });
  }
  for (const field of UTM_FIELDS) if (url.searchParams.getAll(field).length > 1 && !errors.some((error) => error.field === field)) errors.push({ field, message: "UTM duplicada: informe um valor e escolha substituir." });
  for (const rule of governance.conditions) {
    if (url.searchParams.get(rule.field) === rule.equals && (rule.channel === "any" || rule.channel === input.channel) && url.searchParams.get(rule.target) !== rule.value) (rule.severity === "error" ? errors : warnings).push({ field: rule.target, message: `Quando ${rule.field}=${rule.equals} e canal=${rule.channel}, use ${rule.target}=${rule.value}.` });
  }
  if (url.href.length > 8192) errors.push({ field: "url", message: "URL resultante excede 8192 caracteres." });
  return { url: url.href, errors, warnings, corrections, conflicts, appliedValues: { fields: Object.fromEntries(UTM_FIELDS.map((key) => [key, url.searchParams.get(key)])), custom: input.custom.map(({ key }) => ({ key, values: url.searchParams.getAll(key) })), channel: input.channel } };
}

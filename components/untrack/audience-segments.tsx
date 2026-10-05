"use client";

import Link from "next/link";
import { useState } from "react";
import { FiPlus, FiTrash2 } from "react-icons/fi";
import { analytics } from "@/lib/client/analytics";
import { apiRequest } from "./shared";
import styles from "./audience-dashboard.module.css";

type Rule = {
  field: "source" | "campaign" | "tag" | "status" | "engagement";
  value: string;
};
type Segment = {
  id: string;
  name: string;
  description: string;
  rules: Rule[];
  updatedAt: string;
};
type Options = {
  sources: string[];
  campaigns: Array<{ id: string; name: string }>;
  tags: Array<{ id: string; name: string }>;
};

const labels = {
  source: "Origem",
  campaign: "Campanha",
  tag: "Tag",
  status: "Status",
  engagement: "Engajamento",
};

function valuesFor(field: Rule["field"], options: Options) {
  if (field === "source") return options.sources.map((value) => ({ value, label: value }));
  if (field === "campaign") return options.campaigns.map((item) => ({ value: item.id, label: item.name }));
  if (field === "tag") return options.tags.map((item) => ({ value: item.id, label: item.name }));
  if (field === "status") return [["new", "Novo"], ["engaged", "Engajado"], ["converted", "Convertido"]].map(([value, label]) => ({ value, label }));
  return [["low", "Baixo"], ["medium", "Médio"], ["high", "Alto"]].map(([value, label]) => ({ value, label }));
}

export function AudienceSegments({ initial, options, canEdit }: { initial: Segment[]; options: Options; canEdit: boolean }) {
  const [segments, setSegments] = useState(initial);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState<Rule[]>([{ field: "source", value: "" }]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateRule(index: number, next: Partial<Rule>) {
    setRules((current) => current.map((rule, ruleIndex) => ruleIndex === index ? { ...rule, ...next } : rule));
  }

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || rules.some((rule) => !rule.value)) return;
    setBusy(true);
    setError("");
    try {
      const segment = await apiRequest<Segment>("/api/audience/segments", {
        method: "POST",
        body: JSON.stringify({ name, description, rules }),
      });
      setSegments((current) => [segment, ...current]);
      setName("");
      setDescription("");
      setRules([{ field: "source", value: "" }]);
      analytics.track("segment_created");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível criar o segmento.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    setBusy(true);
    try {
      await apiRequest(`/api/audience/segments/${id}`, { method: "DELETE" });
      setSegments((current) => current.filter((segment) => segment.id !== id));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível remover o segmento.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div><span className="eyebrow">Audience</span><h1>Segmentos</h1><p>Grupos dinâmicos atualizados a partir de regras.</p></div>
        <div className={styles.headingActions}><Link href="/untrack/audience">Contatos</Link><Link href="/untrack/audience/segments" aria-current="page">Segmentos</Link><Link href="/untrack/audience/forms">Formulários</Link></div>
      </header>
      {canEdit && <form className={styles.segmentBuilder} onSubmit={(event) => void create(event)}>
        <label>Nome<input required value={name} maxLength={120} onChange={(event) => setName(event.target.value)} placeholder="Leads do Instagram" /></label>
        <label>Descrição<input value={description} maxLength={500} onChange={(event) => setDescription(event.target.value)} placeholder="Opcional" /></label>
        <fieldset><legend>Regras (AND)</legend>{rules.map((rule, index) => <div key={`${rule.field}-${index}`} className={styles.segmentRule}><select value={rule.field} onChange={(event) => updateRule(index, { field: event.target.value as Rule["field"], value: "" })}>{Object.entries(labels).filter(([field]) => !rules.some((item, itemIndex) => itemIndex !== index && item.field === field)).map(([field, label]) => <option key={field} value={field}>{label}</option>)}</select><select required value={rule.value} onChange={(event) => updateRule(index, { value: event.target.value })}><option value="">Selecione</option>{valuesFor(rule.field, options).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>{rules.length > 1 && <button type="button" title="Remover regra" aria-label="Remover regra" onClick={() => setRules((current) => current.filter((_, ruleIndex) => ruleIndex !== index))}><FiTrash2 aria-hidden="true" /></button>}</div>)}</fieldset>
        <div className={styles.segmentActions}><button type="button" className="button button-secondary" disabled={rules.length >= 5 || Object.keys(labels).length === rules.length} onClick={() => setRules((current) => [...current, { field: (Object.keys(labels).find((field) => !current.some((rule) => rule.field === field)) ?? "source") as Rule["field"], value: "" }])}><FiPlus aria-hidden="true" /> Adicionar regra</button><button className="button" type="submit" disabled={busy}>Criar segmento</button></div>
      </form>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className={styles.segmentList}>{segments.length ? segments.map((segment) => <article key={segment.id}><div><h2>{segment.name}</h2>{segment.description && <p>{segment.description}</p>}<small>{segment.rules.map((rule) => labels[rule.field]).join(" AND ")}</small></div><div><Link href={`/untrack/audience?segment=${encodeURIComponent(segment.id)}`} onClick={() => analytics.track("segment_opened")}>Ver contatos</Link>{canEdit && <button type="button" title="Excluir segmento" aria-label={`Excluir ${segment.name}`} disabled={busy} onClick={() => void remove(segment.id)}><FiTrash2 aria-hidden="true" /></button>}</div></article>) : <p className={styles.empty}>Nenhum segmento criado.</p>}</div>
    </section>
  );
}
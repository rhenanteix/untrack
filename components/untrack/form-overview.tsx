import Link from "next/link";
import type { SmartPageFormOverview } from "@/modules/smart-pages/forms";
import styles from "./form-overview.module.css";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function metric(value: number, label: string) {
  return (
    <div>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function FormOverview({
  forms,
  selectedId,
}: {
  forms: Array<
    Omit<SmartPageFormOverview, "createdAt" | "updatedAt"> & {
      createdAt: string;
      updatedAt: string;
    }
  >;
  selectedId?: string;
}) {
  const selected = forms.find((form) => form.id === selectedId) ?? forms[0];
  return (
    <section className={styles.dashboard}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Audience</span>
          <h1>Formulários</h1>
          <p>Submissões e contatos capturados nas suas Smart Pages.</p>
        </div>
        <Link className="button button-secondary" href="/untrack/audience">
          Contatos
        </Link>
      </header>
      {!forms.length ? (
        <section className={styles.empty}>
          <h2>Nenhum formulário criado</h2>
          <p>
            Adicione um formulário em uma Smart Page para acompanhar os
            resultados aqui.
          </p>
          <Link className="button" href="/untrack/smart-pages">
            Abrir Smart Pages
          </Link>
        </section>
      ) : (
        <div className={styles.workspace}>
          <nav className={styles.list} aria-label="Formulários">
            {forms.map((form) => (
              <Link
                key={form.id}
                href={`/untrack/audience/forms?form=${encodeURIComponent(form.id)}`}
                aria-current={selected?.id === form.id ? "page" : undefined}
              >
                <span>
                  <strong>{form.name}</strong>
                  <small>{form.smartPage.title}</small>
                </span>
                <i data-status={form.status}>
                  {form.status === "active" ? "Ativo" : "Inativo"}
                </i>
              </Link>
            ))}
          </nav>
          {selected && (
            <section className={styles.detail}>
              <header>
                <div>
                  <span className="eyebrow">Formulário</span>
                  <h2>{selected.title}</h2>
                  <p>
                    Na Smart Page {selected.smartPage.title} · atualizado em{" "}
                    {formatDate(selected.updatedAt)}
                  </p>
                </div>
                <Link
                  href={`/${encodeURIComponent(selected.smartPage.slug)}`}
                  target="_blank"
                >
                  Ver página pública
                </Link>
                <Link
                  href={`/untrack/audience?form=${encodeURIComponent(selected.id)}`}
                >
                  Ver contatos
                </Link>
              </header>
              <dl className={styles.metrics}>
                {metric(selected.views, "Visualizações")}
                {metric(selected.submissions, "Submissões")}
                {metric(selected.contacts, "Contatos únicos")}
                {metric(selected.leads, "Novos contatos")}
                <div>
                  <strong>{selected.submissionRate}%</strong>
                  <span>Taxa de envio</span>
                </div>
              </dl>
            </section>
          )}
        </div>
      )}
    </section>
  );
}

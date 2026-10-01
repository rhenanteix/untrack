"use client";
import Link from "next/link";
export function WorkspaceLoadError({
  title,
  message,
  code,
}: {
  title: string;
  message: string;
  code: string;
}) {
  return (
    <section className="workspace-error" role="alert">
      <span className="eyebrow">Workspace</span>
      <h1>{title}</h1>
      <p>{message}</p>
      <small>Referência: {code}</small>
      <div className="action-row">
        <button className="button" onClick={() => window.location.reload()}>
          Tentar novamente
        </button>
        <Link className="button button-secondary" href="/conta">
          Voltar à minha conta
        </Link>
      </div>
    </section>
  );
}

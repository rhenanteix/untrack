"use client";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <section className="shell page-section">
      <div className="tool-card">
        <h1>Não conseguimos carregar sua conta.</h1>
        <p>Tente novamente em instantes.</p>
        <button className="button" onClick={reset}>
          Tentar novamente
        </button>
      </div>
    </section>
  );
}

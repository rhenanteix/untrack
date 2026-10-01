"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
  error,
}: {
  reset: () => void;
  error: Error & { digest?: string };
}) {
  return (
    <section className="workspace-error" role="alert">
      <span className="eyebrow">Algo interrompeu o carregamento</span>
      <h1>Não foi possível abrir este módulo</h1>
      <p>
        Seus dados não foram alterados. Tente carregar novamente ou volte à sua
        conta para escolher outro workspace.
      </p>
      {error.digest && <small>Referência: {error.digest}</small>}
      <div className="action-row">
        <button className="button" onClick={reset}>
          Tentar novamente
        </button>
        <Link href="/conta" className="button button-secondary">
          Voltar à minha conta
        </Link>
      </div>
    </section>
  );
}

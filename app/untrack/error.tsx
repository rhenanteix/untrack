"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="shell tool-card"><p role="alert">Não foi possível carregar o workspace.</p><button className="button" onClick={reset}>Tentar novamente</button></div>; }

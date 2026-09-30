import type { Metadata } from "next";
import { Suspense } from "react";
import { QrGenerator } from "@/components/qr-generator";

export const metadata: Metadata = {
  title: "Gerar QR Code",
  description:
    "Transforme qualquer URL válida em um QR Code para baixar e compartilhar.",
  alternates: { canonical: "/gerar-qrcode" },
};

export default function QrPage() {
  return (
    <section className="shell page-section">
      <div className="page-heading">
        <span className="eyebrow">QR Code de URL</span>
        <h1>Leve seu link para qualquer tela.</h1>
        <p>
          Gere um QR Code em PNG, pronto para materiais digitais ou impressos.
        </p>
      </div>
      <Suspense fallback={<div className="tool-card">Carregando gerador…</div>}>
        <QrGenerator />
      </Suspense>
      <article className="prose-card">
        <h2>Como usar seu QR Code?</h2>
        <p>
          Baixe o arquivo PNG e teste o código antes de publicar. Preserve uma
          margem clara ao redor da imagem para facilitar a leitura pela câmera.
        </p>
      </article>
    </section>
  );
}

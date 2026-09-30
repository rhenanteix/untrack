import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="shell footer-inner">
        <div>
          <strong>Arrume Meu Link</strong>
          <p>Cole seu link. A gente arruma.</p>
        </div>
        <nav aria-label="Links do rodapé">
          <Link href="/limpar-link">Limpar link</Link>
          <Link href="/gerar-utm">Criar UTM</Link>
          <Link href="/gerar-qrcode">QR Code</Link>
          <Link href="/encurtar">Encurtar</Link>
          <Link href="/conta">Minha conta</Link>
        </nav>
      </div>
    </footer>
  );
}

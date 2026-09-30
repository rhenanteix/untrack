const topics = [
  [
    "O que é uma URL?",
    "É o endereço de um conteúdo na internet. Ela combina protocolo, domínio, caminho e, às vezes, parâmetros que ajustam o conteúdo exibido.",
  ],
  [
    "O que são parâmetros UTM?",
    "São identificadores adicionados à URL para medir a origem, o meio e a campanha de uma visita em ferramentas de analytics.",
  ],
  [
    "O que são trackers?",
    "São parâmetros usados por plataformas para atribuir cliques e campanhas. Eles podem deixar o link longo sem mudar a página de destino.",
  ],
  [
    "Por que limpar links?",
    "Links menores são mais fáceis de ler, copiar e compartilhar. A limpeza também reduz rastreamento desnecessário sem remover parâmetros funcionais.",
  ],
  [
    "É seguro remover UTMs?",
    "Em geral, sim: UTMs medem campanhas e não alteram o conteúdo. Parâmetros desconhecidos são sempre preservados por esta ferramenta.",
  ],
  [
    "Como criar uma UTM?",
    "Informe a URL de destino e os dados da campanha. A ferramenta codifica os campos e gera um endereço pronto para compartilhar.",
  ],
  [
    "Como gerar QR Code?",
    "Cole uma URL válida, gere o código e baixe o PNG. Quem escanear será direcionado ao endereço informado.",
  ],
] as const;

export function SeoContent() {
  return (
    <section className="shell content-section" aria-labelledby="entenda-links">
      <div className="section-heading">
        <span className="eyebrow">Entenda seus links</span>
        <h2 id="entenda-links">Simples por fora. Cuidadoso por dentro.</h2>
      </div>
      <div className="topic-grid">
        {topics.map(([title, text]) => (
          <article key={title}>
            <h3>{title}</h3>
            <p>{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

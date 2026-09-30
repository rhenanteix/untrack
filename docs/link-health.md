# Link Health

Página: `/link-health`. API: `POST /api/link-health` com JSON
`{ "url": "https://example.com/" }`. Resposta: `{ "health": LinkHealthReport }`.

O módulo avalia **saúde técnica em uma amostra**, sem declarar segurança do link,
conteúdo, origem ou usuário. Não inspeciona malware, phishing, reputação, execução
JavaScript ou sub-recursos. HTTP 200 e HTTPS são sinais técnicos limitados.

## Política central e razões

`modules/link-health/config.ts` contém a política versionada: pesos, faixa HTTP
de sucesso, tempo aceitável e quantidade aceitável de redirects. Para alterar
pesos, redistribua os 100 pontos e atualize `version`. A validação recusa valores
negativos, pesos fracionários, soma diferente de 100 e limites inválidos. A faixa
HTTP de sucesso pode ser restringida dentro de 200–299.

A política inicial usa os pesos do exemplo de produto; os 25 pontos restantes
foram divididos em estrutura (10), tracking (5) e disponibilidade (10), evitando
um bônus genérico de “sem problemas”. Os pesos são uma convenção de produto
explícita, não uma probabilidade, padrão universal ou medida de segurança.

| Check                  | Pontos | Regra para conceder todos os pontos                                           | Razão do peso                                                                   |
| ---------------------- | -----: | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| HTTPS                  |     20 | URL válida, inspeção concluída e URL inicial, cadeia e destino final em HTTPS | Prioriza transporte com TLS; não certifica o conteúdo                           |
| HTTP status            |     25 | Status terminal entre 200 e 299, inspeção concluída                           | Principal sinal de resposta HTTP bem-sucedida                                   |
| Redirects              |     15 | Inspeção concluída e até 2 redirects seguidos, inclusive                      | Tolera canonicalização comum; cadeias longas acrescentam dependências           |
| Response time          |     15 | Inspeção concluída em até 2000 ms, inclusive                                  | Orçamento inicial de experiência; inclui DNS, redirects e leitura limitada      |
| URL structure          |     10 | URL HTTP/HTTPS absoluta, até 4096 caracteres, sem credenciais                 | Requisito estrutural para uso web, distinto de acessibilidade                   |
| Tracking parameters    |      5 | URL válida e nenhum parâmetro reconhecido no catálogo da query inicial        | Sinal de compartilhamento com menos tracking; impacto menor que falhas técnicas |
| Disponibilidade básica |     10 | Destino final respondeu na faixa de sucesso e a leitura limitada terminou     | Confirma que esta amostra foi concluída; não apenas que chegaram headers        |

O check de HTTP status e o de disponibilidade são relacionados: um avalia o
código, o outro a conclusão da inspeção. **Ambos exigem conclusão**, de modo que
um HTTP 200 seguido de timeout ou resposta grande não concede esses pontos.

Os limites de 2 redirects e 2000 ms são escolhas ajustáveis desta política,
não os limites de proteção de rede: o transporte permite até 5 redirects e tem
prazo total de 10 segundos. A medição de tempo inclui toda a análise e não é TTFB.

Cada check retorna `status` (`pass`, `fail` ou `unknown`), `points`, `maxPoints` e
`reason`. Um check atendido recebe seu peso integral; um check falho ou
inconclusivo recebe zero. `healthScore` é exatamente a soma de `points`, sem
bônus, descontos ocultos, arredondamento ou redistribuição de pontos não medidos.

Exemplos com todos os outros checks atendidos:

- HTTPS + HTTP 200 + até 2 redirects + até 2000 ms + estrutura válida + sem
  tracking + disponibilidade confirmada: **100/100**.
- HTTP 404: **65/100**, perdendo status (25) e disponibilidade (10).
- Inspeção de 2001 ms: **85/100**, perdendo tempo (15).
- Tracking identificado: **95/100**, perdendo tracking (5).
- URL válida sem tracking, mas DNS/SSRF/timeout impedindo conclusão: **15/100**,
  apenas estrutura e query observadas. Não significa disponibilidade parcial.
- URL inválida: **0/100**.

Um score alto nunca é apresentado como declaração de segurança. Mesmo 100
significa apenas que os checks desta política foram atendidos nesta amostra.

## Relatório e interface

`evaluateLinkHealth(analysis, config?)` é uma função pura, testável sem rede.
`checkLinkHealth(url)` chama o Link Analyzer uma vez e aplica a configuração
central do servidor. O cliente não pode modificar pesos ou limites de rede.

O relatório expõe:

- `healthScore`, `maxScore`, `policyVersion`, `scope` e `checks`;
- `problems`: falhas estruturais, status/disponibilidade não confirmados e erros
  técnicos do Analyzer (SSRF, timeout, DNS, TLS, limites, redirects);
- `warnings`: sinais como HTTP, tempo elevado, redirects excessivos, tracking,
  checks inconclusivos e parâmetros desconhecidos;
- `recommendations`: ações deduplicadas, sem descontar pontos adicionais;
- `availability`: `available` (sucesso nesta amostra), `not-confirmed` (resposta
  terminal sem sucesso) ou `not-checked` (inspeção incompleta);
- `measurements`: estrutura da URL, status HTTP, tempo total, quantidade/cadeia
  de redirects, destino final e classificação dos parâmetros.

A página mostra a pontuação de cada check e sua razão, problemas, avisos,
recomendações e as medições. Destinos são texto, inclusive redirects anunciados
que foram bloqueados. Erros e carregamento são anunciados de forma acessível.

Parâmetros desconhecidos e funcionais são preservados e não reduzem a pontuação.
Ausência de tracking no catálogo não implica ausência de outros mecanismos de
tracking. Redirects e parâmetros de campanha podem ser legítimos.

O score anterior de `LinkAnalysis` permanece no contrato legado do Analyzer;
o Link Health **não o utiliza nem o expõe**. Para avaliar saúde técnica com esta
política configurável e checks, use `/api/link-health`.

## Proteções e API

O serviço reutiliza `modules/link-analyzer/network.ts`: HTTP/HTTPS sem
credenciais, bloqueio de localhost, IPs privados, loopback, link-local e metadata,
checagem de todos os IPs DNS e conexão fixada ao IP validado mantendo Host/TLS.
Cada redirect é revalidado. Timeout total de 10 segundos inclui DNS, conexão,
redirects e corpo. Limites: 5 redirects, headers de 16 KiB e corpo de 64 KiB.
Nenhum cookie ou header de autorização do usuário é encaminhado.

Checks bloqueados ou incompletos têm razões explícitas; um status intermediário
não é confundido com resposta final. `finalDestination` só existe após resposta
terminal completa. As limitações de rede podem impedir inspecionar sites que
funcionam normalmente para um navegador.

O endpoint usa Node.js, `Cache-Control: no-store` e rate limit do projeto no
bucket `link-health`. Payload inválido retorna 400, mídia incompatível 415,
rate limit 429 e indisponibilidade do limiter em produção 503. Uma URL inválida
ou inacessível dentro de um payload válido retorna HTTP 200 com seu relatório.

## Testes

Testes unitários cobrem cada regra e seus limites, soma dos pontos, alterações de
configuração, estados incompletos, HTTP 200 parcial, preservação de parâmetros,
renderização do relatório, contrato de API, SSRF direto e por redirect e timeout.
Os testes de transporte do Analyzer também continuam verificando DNS pinning,
DNS rebinding, IPv6, loops, quantidade de redirects e limites de resposta.

```sh
npm run lint
npm test
npm run build
```

Em ambientes onde o Turbopack não pode abrir a porta interna para processar CSS,
é possível validar o build com `npm run build -- --webpack`.

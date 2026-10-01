# Link Analyzer

O módulo `modules/link-analyzer/analyze.ts` exporta `analyzeLink(url)` e os tipos
estão em `modules/link-analyzer/types.ts`. A análise não modifica nem limpa a URL.

## API

`POST /api/link-analyzer`, runtime Node.js, com `Content-Type: application/json`:

```json
{ "url": "https://shop.example.com.br/products?id=7&utm_source=news#details" }
```

A resposta é `{ "analysis": LinkAnalysis }`, com `Cache-Control: no-store` e os
headers do rate limiter existente (bucket `link-analyzer`). O endpoint legado
`/api/links/analyze` continua atendendo ao limpador de links.

- `valid`: URL HTTP/HTTPS válida, sem credenciais, com até 4096 caracteres.
  Validade não significa que o destino seja público ou esteja acessível.
- `input`, `normalizedUrl`, `protocol` (sem `:`), `hostname`, `domain`, `path`,
  `query` (sem `?`), `fragment` (sem `#`) e `https`: componentes da URL inicial.
  `domain` usa a Public Suffix List via `tldts`, incluindo sufixos privados como
  `github.io`; IPs e nomes sem domínio registrável retornam `null`.
- `tracking`, `functionalParameters`, `unknownParameters`: listas de
  `{ name, value, reason }`. Preservam ordem, duplicatas e valores vazios; valores
  são decodificados por `URLSearchParams`. Nenhum parâmetro é removido.
- `networkStatus`: `completed`, `blocked` (SSRF), `failed` ou `skipped` (inválida).
- `httpStatus`: último status recebido; `null` quando nenhum está disponível.
- `redirectChain`: respostas de redirect com `{ url, status, destination }`.
  `destination` representa o Location resolvido e **não garante um destino seguro
  ou visitado**. Ausente/inválido retorna `null`.
- `redirectCount`: redirects seguidos até receber uma resposta HTTP.
- `responseTimeMs`: tempo total da análise, incluindo DNS, redirects e leitura
  limitada da resposta; não é somente a latência do destino final.
- `finalDestination`: URL da resposta terminal (inclui erros HTTP); `null` se a
  inspeção ficou incompleta. Fragmentos não são enviados na inspeção de rede.
- `issues`: problemas com `code`, `severity`, `message`, `recommendation`, `penalty`.
- `recommendations`: recomendações deduplicadas.
- `healthScore`: `max(0, 100 - soma das penalidades)`.

URLs inválidas, destinos bloqueados e falhas de rede produzem análise com HTTP 200. Payload malformado, tipo incorreto ou URL acima do limite retornam 400;
Content-Type incompatível retorna 415. Rate limit retorna 429 e a ausência de
rate limiter em produção retorna 503, seguindo a política existente.

## Classificação e pontuação

Tracking reutiliza o catálogo `modules/links/tracker-categories.ts`, que inclui
`utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`,
`dclid`, `gbraid`, `wbraid`, `fbclid`, `msclkid`, `ttclid`, `twclid`, `mc_cid`,
`mc_eid`, `_ga`, `_gl` e outras regras já usadas pelo limpador. A classificação
ignora maiúsculas/minúsculas para tracking.

Parâmetros funcionais são uma **heurística pelo nome**, sensível a maiúsculas:
`q`, `query`, `search`, `page`, `limit`, `offset`, `sort`, `order`, `filter`, `id`,
`lang`, `locale`. Os demais são desconhecidos e devem ser preservados. A
classificação se refere à query inicial, não às queries dos redirects.

| Problema                                                                     |                  Desconto |
| ---------------------------------------------------------------------------- | ------------------------: |
| URL inválida, protocolo/credenciais não permitidos ou SSRF                   |                       100 |
| Inspeção incompleta (DNS/TLS/conexão, timeout, limites, redirects inválidos) |                        50 |
| Status final HTTP >= 400                                                     |                        40 |
| Redirect de HTTPS para HTTP                                                  |                        20 |
| URL inicial HTTP                                                             |                        15 |
| Presença de tracking                                                         |                        10 |
| Redirects seguidos                                                           | 5 por redirect, máximo 20 |
| Parâmetros desconhecidos                                                     |                         0 |

O score é uma heurística explicável de qualidade do link, não uma certificação
contra phishing ou malware. Redirecionamentos são sinalizados mesmo quando
legítimos. Respostas interrompidas ou grandes podem pertencer a sites funcionais;
a análise informa a limitação em vez de declarar sucesso da inspeção.

## Proteção de rede

- Apenas HTTP/HTTPS sem credenciais; rejeita `file:`, `javascript:`, `data:` e `ftp:`.
- Bloqueia localhost (incluindo subdomínios e ponto final), nomes locais,
  loopback, IPs privados, link-local, multicast, faixas reservadas, endereços de
  transição IPv6 e metadata endpoints (incluindo o IP de plataforma Azure).
- Normalização WHATWG trata representações IPv4 alternativas; endereços IPv4
  mapeados em IPv6 são verificados como IPv4.
- Todos os endereços retornados pelo DNS precisam ser públicos. A conexão fixa
  o IP validado, mantendo Host e a verificação TLS para o hostname original.
- Cada destino de redirect tem protocolo, credenciais, hostname e DNS revalidados.
  Segue somente 301/302/303/307/308, até cinco redirects; detecta loops.
- GET sem cookies ou autorização do cliente, sem reaproveitar conexões; não
  executa scripts, meta-refresh nem carrega sub-recursos.
- Timeout total de 10 segundos, incluindo espera por DNS e todos os redirects.
  A espera DNS é interrompida no prazo; a resolução do sistema pode terminar
  posteriormente, mas não inicia uma conexão após o cancelamento.
- Headers limitados a 16 KiB e corpo a 64 KiB por resposta. Corpos de redirects
  são descartados imediatamente. Solicita `Accept-Encoding: identity` e não
  descomprime respostas. Não guarda o corpo recebido.

## Verificação

```sh
npm run lint
npm test
npm run build
```

Os testes unitários usam DNS e transportes simulados, sem depender da internet,
para verificar classificação, domínio, score, contrato da API, SSRF, DNS rebinding,
redirects, timeout e limites de resposta.

## Link Health

Para pontuação técnica configurável, razões por check e interface visual, use
[Link Health](link-health.md) em `/link-health` ou `POST /api/link-health`.

### Modelos de Smart Pages

O editor oferece nove modelos (Studio, Aura, Forma, After Hours, Atelier,
Amplifica, Botânica, Maré e Café), filtrados por categoria. Escolha o modelo
em **Identidade visual** e use **Salvar perfil** para persistir a seleção.
Em páginas publicadas, salvar atualiza a apresentação imediatamente.
Os exemplos da galeria são demonstrativos; selecionar um modelo preserva
textos, avatar, links e redes sociais da página.

Galeria, prévia e página pública usam o componente `PageDesign`. Os IDs
persistidos e metadados estão em `modules/smart-pages/themes.ts`; a aparência
está em `components/smart-pages/themes.module.css`. IDs antigos continuam
válidos. A seleção de outro modelo aplica sua paleta padrão; editar outros
campos preserva eventuais cores personalizadas já salvas. Um PATCH que contém
apenas `theme` preserva a descrição. A prévia não registra analytics.

Os modelos usam o campo JSON `SmartPage.theme` existente: nenhuma migration,
variável de ambiente ou serviço externo adicional é necessário.

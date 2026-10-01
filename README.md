# Arrume Meu Link

Aplicação web em português para remover parâmetros de rastreamento de URLs, analisar o que foi removido ou preservado, criar campanhas UTM, gerar QR Codes e verificar se um endereço está acessível com proteção contra SSRF. O uso básico não exige conta e o histórico recente fica no `localStorage` do navegador.

A V2 adiciona cadastro/login, links curtos, páginas públicas de compartilhamento, métricas privadas por link e histórico sincronizado por conta em PostgreSQL. Veja a [entrega da V2](docs/roadmap-v2.md).

## Funcionalidades

- limpeza seletiva de UTMs e trackers de Google, Meta, Microsoft, TikTok, X, Mailchimp, analytics e genéricos;
- preservação de parâmetros legítimos, caminho, fragmento e valores repetidos;
- comparação antes/depois, estatísticas que sempre somam o total e histórico local;
- criação de URL com `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` e `utm_content`;
- QR Code em data URL ou PNG;
- verificação server-side de disponibilidade, redirecionamentos e tipo de conteúdo;
- APIs JSON com validação Zod, respostas de erro uniformes e rate limiting;
- navegação por menu no celular, sem corte de conteúdo.
- cadastro, login e logout com Better Auth e sessões em PostgreSQL;
- encurtador com códigos aleatórios, desativação, reativação e exclusão;
- página pública com destino visível, título, descrição e QR Code;
- painel privado de cliques por dia, origem e dispositivo;
- histórico de limpeza/UTM/QR sincronizado por conta e importação opcional do histórico local.

## Arquitetura

O projeto usa o App Router do Next.js. Páginas em `app/` renderizam os componentes React de `components/`; esses componentes chamam Route Handlers em `app/api/`. Regras puras e testáveis ficam em `modules/` — `links` (limpeza, categorias e schemas de URL), `utm` (schemas e serviço de campanha), `qr-code` (schemas e renderização) e `validation` (definição de URL web válida). Recursos de infraestrutura — SSRF, rate limiting, analytics e Prisma — ficam em `lib/`.

Fluxo principal:

1. o navegador envia URL e categorias para `POST /api/links/analyze`;
2. Zod valida protocolo, credenciais, tamanho e formato;
3. `analyzeUrl` remove somente categorias selecionadas e devolve estatísticas;
4. o resultado é exibido e registrado no `localStorage`; com sessão ativa, também é salvo no histórico privado da conta;
5. persistência de eventos analíticos é opcional e não armazena o link.

As estatísticas contam **ocorrências**, não nomes distintos, então
`rastreadores removidos + parâmetros preservados` sempre iguala
`parâmetros encontrados`, inclusive com parâmetros repetidos. As listas de
"Removidos" e "Preservados" exibem nomes distintos, sem repetição.

## Stack

- Next.js 16, React 19 e TypeScript strict;
- Tailwind CSS 4 instalado como pipeline, com o design system em CSS
  semântico próprio em `app/globals.css` (nenhuma dependência de utilitário);
- Zod para contratos;
- `qrcode` para imagens;
- `ipaddr.js` e APIs nativas DNS/HTTP para proteção SSRF;
- Upstash Redis/Rate Limit;
- Prisma 6 e PostgreSQL para contas, links, histórico e métricas da V2;
- Better Auth para autenticação por e-mail/senha e sessões;
- Vitest + V8 para unitários e Playwright para E2E.

## Requisitos e instalação

- Node.js 22 recomendado (o `vitest` declara `engines.node: ^22.12 || ^24 || >=26`);
- npm 11 ou superior — o npm 10 falha ao reconstruir a árvore de dependências
  deste projeto com `Cannot read properties of null (reading 'edgesOut')`;
- npm;
- Chromium do Playwright para E2E;
- PostgreSQL para a V2 (Docker Compose disponível para desenvolvimento);
- conta Upstash obrigatória em produção.

```bash
git clone <URL_DO_REPOSITORIO>
cd arrume-meu-link
npm ci
npm run setup:local
npm run dev
```

Com o Docker em execução, `setup:local` gera `.env.local` com segredos aleatórios, preserva configurações existentes, sobe PostgreSQL na porta **55432**, gera o Prisma Client e aplica as migrations. Cria bancos separados para aplicação e E2E. Os dados persistem em volume Docker; `npm run db:stop` para o banco sem apagar dados. Para usar um PostgreSQL externo, configure as variáveis manualmente e execute `npm run prisma:generate` e `npm run prisma:deploy`.

Para E2E, instale o browser com `npx playwright install chromium` ou configure `PLAYWRIGHT_EXECUTABLE_PATH` conforme a seção de testes.

O `npm ci` **no macOS ou Windows** falha com `EBADPLATFORM` se
`@rolldown/binding-win32-x64-msvc` estiver declarado como dependência direta: esse
é um binário nativo exclusivo do Windows e deve chegar apenas como dependência
opcional de `rolldown`, resolvida pelo npm conforme a plataforma.

## Variáveis de ambiente

| Variável                   | Obrigatória  | Uso                                                         |
| -------------------------- | ------------ | ----------------------------------------------------------- |
| `NEXT_PUBLIC_APP_URL`      | recomendada  | URL pública/canônica, por exemplo `http://localhost:3000`   |
| `UPSTASH_REDIS_REST_URL`   | produção     | endpoint REST do Redis Upstash                              |
| `UPSTASH_REDIS_REST_TOKEN` | produção     | token REST do Redis Upstash                                 |
| `DATABASE_URL`             | V2           | conexão PostgreSQL da aplicação                             |
| `TEST_DATABASE_URL`        | E2E          | banco separado, com nome terminado em `_test`               |
| `POSTGRES_PASSWORD`        | Docker local | senha do banco; gerada por `setup:local`                    |
| `BETTER_AUTH_SECRET`       | V2           | segredo aleatório de pelo menos 32 caracteres               |
| `BETTER_AUTH_URL`          | V2           | origem pública da autenticação, igual à origem da aplicação |
| `ANALYTICS_PERSISTENCE`    | não          | `none` (padrão) ou `prisma` para persistir eventos          |
| `ANALYTICS_CONSOLE`        | não          | `true` registra eventos no console quando Prisma está off   |
| `RATE_LIMIT_REQUESTS`      | não          | requisições por janela, padrão `100`                        |
| `RATE_LIMIT_WINDOW`        | não          | janela em segundos, padrão `3600`                           |
| `WHATSAPP_INTELLIGENCE`    | não          | `true` habilita o módulo WhatsApp Intelligence              |

A chave de persistência é `ANALYTICS_PERSISTENCE=prisma`. Não coloque segredos
`UPSTASH_*` ou `DATABASE_URL` no cliente nem no repositório.

### Persistência de contas e analytics

As contas, sessões, links, visitas e histórico da V2 são persistidos em PostgreSQL independentemente de `ANALYTICS_PERSISTENCE`. Essa variável controla somente os eventos gerais da V1. Para também persistir esses eventos:

1. crie o banco e defina `DATABASE_URL`;
2. execute `npm run prisma:generate`;
3. crie/aplique a migração com `npm run prisma:migrate`;
4. defina `ANALYTICS_PERSISTENCE=prisma`;
5. reinicie o servidor.

Em CI/produção, aplique as migrations versionadas com `npm run prisma:deploy`. Nenhum comando de desenvolvimento deve resetar o banco de produção.

## Desenvolvimento

```bash
npm run dev
```

Abra <http://localhost:3000>. Rotas de interface:

- `/` — limpeza e análise;
- `/limpar-link` — ferramenta de limpeza;
- `/gerar-utm` — construtor UTM;
- `/gerar-qrcode` — gerador de QR Code.
- `/encurtar` — criação de links curtos, com conta;
- `/cadastro` e `/entrar` — autenticação;
- `/conta` — links e histórico privado;
- `/conta/links/[id]` — métricas privadas do link;
- `/l/[slug]` — página pública de compartilhamento;
- `/s/[slug]` — redirecionamento HTTP 302, sem cache.

Outros comandos:

```bash
npm run lint
npm run format:check
npm run build
npm start
```

## Testes

```bash
npm test                 # Vitest
npm run test:coverage    # cobertura V8 em modules/**
npm run test:e2e         # sobe next dev isolado na porta 3100 e executa Playwright
```

Os unitários cobrem remoção e preservação, categorias/prefixos, coerência das
estatísticas com parâmetros repetidos, URL e encoding, geração UTM, renderização
de QR Code, schemas e SSRF (protocolos, credenciais, localhost, redes privadas,
metadata, IPv6, DNS misto e redirects simulados sem rede externa).

Os E2E rodam em Chromium desktop e emulação de iPhone 13 e cobrem a homepage,
erro de URL inválida, ausência e multiplicidade de trackers, parâmetros
legítimos e repetidos, clipboard, navegação até o gerador de QR Code usando as
APIs reais da aplicação, o menu mobile, o controle de categorias (inclusive
genéricos) e a responsividade de 320px a 1440px.

O Playwright roda em Chromium desktop e emulação de iPhone 13. Em CI, instale o browser antes do teste. Os testes SSRF simulam DNS e transporte HTTP; não dependem da internet.

Os testes E2E usam `.next-e2e` e não disputam o servidor de desenvolvimento da porta 3000. Se o Chromium distribuído pelo Playwright não suportar seu macOS, use o Chrome instalado:

```bash
PLAYWRIGHT_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

A suíte também cobre UTM ponta a ponta, abertura em nova aba, download de PNG, histórico após recarregar, dados locais corrompidos, falhas de clipboard/rede, coleta de analytics sem URLs e metadados SEO. O workflow `.github/workflows/validate.yml` executa lint, cobertura, build e E2E no GitHub.

Na V2, os E2E aplicam migrations em `TEST_DATABASE_URL` e criam contas reais apenas nesse banco. Validam cadastro/login/logout, cookies HttpOnly, revogação de sessão, isolamento entre usuários, CSRF, redirecionamentos, métricas, histórico entre navegadores e importação sem duplicação. A CI fornece um PostgreSQL separado como serviço. Não use credenciais ou banco de produção nos testes.

## Analytics da V1

O navegador envia os eventos de interação para `POST /api/analytics`; operações concluídas são registradas pelos respectivos handlers para evitar duplicidade. A coleta aceita apenas eventos e caminhos conhecidos, sem query strings, URLs submetidas, cookies de identificação ou histórico local. O rate limit usa um bucket próprio, e falhas da coleta não impedem o uso das ferramentas.

Para observar os eventos no terminal local, defina `ANALYTICS_CONSOLE=true` em `.env.local`. Para persistir em PostgreSQL, configure `DATABASE_URL`, gere o client com `npm run prisma:generate`, aplique a migration versionada com `npm run prisma:deploy` e habilite `ANALYTICS_PERSISTENCE=prisma`. Sem console ou persistência habilitados, o sink descarta os eventos. A V1 não inclui dashboard de analytics.

## Segurança SSRF

`POST /api/links/check` é o verificador legado de URLs. Sua implementação:

- aceita somente HTTP/HTTPS e rejeita credenciais;
- resolve DNS antes de cada requisição e rejeita o host se **qualquer** resposta não for unicast pública;
- conecta ao IP validado mantendo `Host` e SNI originais, reduzindo DNS rebinding;
- revalida cada destino de redirect e limita a cinco saltos;
- usa timeout de 5 segundos e, no fallback GET, lê no máximo 64 KiB;
- bloqueia loopback, link-local/metadata (`169.254.169.254`), redes privadas e IPv6 reservado.

Essas medidas são defesa em profundidade, não autorização para acessar redes confiáveis. Mantenha a aplicação isolada de serviços internos, atualize dependências e preserve egress/firewall restritivos.

O Link Analyzer (`POST /api/link-analyzer`) e o Link Health (`POST /api/link-health`) também acessam URLs. Eles compartilham um transporte com timeout total de 10 segundos, DNS fixado ao IP validado, revalidação de redirects e limites de resposta.

## Link Health

Acesse `/link-health` para ver Health Score, checks com razões e pontos, problemas, avisos e recomendações. A política fica em `modules/link-health/config.ts`; nenhum parâmetro é removido e o resultado não garante segurança. Contrato, regras e exemplos: [Link Health](docs/link-health.md).

## Rate limiting

Em desenvolvimento e teste, existe contador em memória por IP e bucket,
configurado por `RATE_LIMIT_REQUESTS` e `RATE_LIMIT_WINDOW`, adequado apenas a
uma instância. Em qualquer outro `NODE_ENV`, a ausência do Upstash faz a API
responder `503 RATE_LIMIT_UNAVAILABLE` — portanto, **Upstash é requisito de
produção**, não um extra. Configure as duas variáveis `UPSTASH_REDIS_REST_*`;
os retornos bem-sucedidos incluem cabeçalhos `X-RateLimit-*`.

Em proxy próprio, encaminhe e higienize `x-vercel-forwarded-for`/`x-real-ip`. Não aceite esses cabeçalhos diretamente de clientes sem um proxy confiável.

## APIs

As rotas de ferramentas que recebem JSON esperam `Content-Type: application/json`, recusam campos extras e podem responder `400 INVALID_INPUT`, `415 UNSUPPORTED_MEDIA_TYPE`, `429 RATE_LIMITED`, `503 RATE_LIMIT_UNAVAILABLE` ou `500 INTERNAL_ERROR`.

### Contas, links e histórico (V2)

| Método / rota                  | Uso                                                                 |
| ------------------------------ | ------------------------------------------------------------------- |
| `POST /api/auth/sign-up/email` | Cadastro (`name`, `email`, `password`)                              |
| `POST /api/auth/sign-in/email` | Login (`email`, `password`)                                         |
| `POST /api/auth/sign-out`      | Revoga a sessão atual                                               |
| `GET /api/auth/get-session`    | Sessão atual                                                        |
| `GET /api/short-links?page=1`  | Lista links da conta, 20 por página                                 |
| `POST /api/short-links`        | Cria link (`url`, `title` e `description` opcionais)                |
| `GET /api/short-links/[id]`    | Link e métricas, apenas para o proprietário                         |
| `PATCH /api/short-links/[id]`  | Ativa/desativa (`isActive`)                                         |
| `DELETE /api/short-links/[id]` | Exclui link e suas visitas                                          |
| `GET /api/history?page=1`      | Histórico da conta, 20 por página                                   |
| `POST /api/history`            | Importa até dez itens locais em `items`, sem duplicar IDs por conta |
| `DELETE /api/history/[id]`     | Remove registro da conta                                            |

As rotas privadas retornam 401 sem sessão e 404 quando o registro não pertence à conta. Mutações recusam origem externa. Os handlers de limpeza/UTM/QR retornam `historySaved` quando respondem em JSON, indicando se salvaram no histórico da conta. A autenticação tem rate limit próprio persistido no PostgreSQL.

### Analisar/limpar

`POST /api/links/analyze` (principal) e `POST /api/links/clean`, que é o mesmo
handler sob o mesmo bucket de rate limit.

```json
{
  "url": "https://exemplo.com/p?utm_source=news&id=7",
  "categories": ["utm", "google", "meta"]
}
```

Retorna `originalUrl`, `cleanUrl`, `statistics`, `removedParameters` e `preservedParameters`. Omitindo `categories`, todas as categorias, inclusive `generic`, são consideradas.

### Criar UTM

`POST /api/utm/generate`.

```json
{
  "url": "https://exemplo.com/produto",
  "source": "newsletter",
  "medium": "email",
  "campaign": "setembro",
  "term": "tenis",
  "content": "hero"
}
```

`source`, `medium` e `campaign` são obrigatórios; a resposta é `{ "url": "..." }`.

### Gerar QR Code

`POST /api/qr/generate`.

```json
{
  "url": "https://exemplo.com",
  "format": "dataUrl",
  "width": 512,
  "margin": 2,
  "errorCorrectionLevel": "M"
}
```

`format` pode ser `dataUrl` (JSON) ou `png` (`image/png`); largura aceita: 128–1024.

### Verificar URL

`POST /api/links/check`:

```json
{ "url": "https://exemplo.com" }
```

Retorna `reachable`, `statusCode`, `responseTime`, `finalUrl`, `contentType`, `redirects` e `method` (`HEAD` ou fallback `GET`). Falhas seguras incluem `UNSAFE_URL`, `URL_UNREACHABLE`, `INVALID_REDIRECT` e `TOO_MANY_REDIRECTS`.

## Estrutura

```text
app/                 páginas, metadata e Route Handlers
components/          componentes client/server da interface
lib/                 infraestrutura, SSRF, rate limit, analytics, Prisma
lib/analytics-events.ts  taxonomia única de eventos (cliente e servidor)
modules/links/       limpeza, categorias e schemas de URL
modules/utm/         schemas e serviço de criação de UTM
modules/qr-code/     schemas e serviço de renderização de QR Code
modules/validation/  definição de URL web válida
prisma/              schema PostgreSQL
public/              ícones e assets estáticos
tests/unit/          testes Vitest
tests/e2e/           testes Playwright
```

## Build e deploy

```bash
npm ci
npm run prisma:generate
npm run prisma:deploy
npm run lint
npm test
npm run build
npm start
```

Na Vercel, importe o repositório, configure as variáveis no ambiente Production e use os comandos padrão do Next.js. Em outro provedor, exponha a porta 3000, execute o artefato com `npm start`, use TLS no proxy e forneça Upstash e PostgreSQL. O build gera o Prisma Client; aplique as migrations antes de liberar a nova versão. Configure `NEXT_PUBLIC_APP_URL` e `BETTER_AUTH_URL` com a mesma origem HTTPS final, além de um `BETTER_AUTH_SECRET` de produção. Publicar o código no GitHub não hospeda a aplicação nem cria um banco na nuvem.

### Serviços externos

1. **Upstash:** crie um Redis, copie REST URL/token e cadastre-os somente no servidor.
2. **PostgreSQL (V2):** crie banco/usuário com privilégios mínimos, defina `DATABASE_URL` e aplique as migrations.
3. **Vercel/provedor:** configure domínio, HTTPS, variáveis por ambiente e logs/alertas.
4. **CI:** use Node 22, `npm ci`, browser Playwright e os comandos de qualidade acima.

## Roadmap

- **V1:** landing page, limpeza, detecção de tracking, copiar, abrir, QR Code, UTM Builder, validação, histórico local, SEO, analytics e testes implementados. Consulte a [auditoria item a item](docs/roadmap-v1.md) para as correções e as configurações de produção pendentes.

- **V2:** encurtador, links compartilháveis, analytics por link, histórico sincronizado por conta e login. Consulte a [entrega da V2](docs/roadmap-v2.md).
- **V3:** dashboards de campanhas, QR Codes customizáveis, presets e importação de URLs em lote;
- **V4:** equipes, API keys/webhooks, políticas corporativas, integrações e
  observabilidade avançada.

Contribuições devem manter a lógica testável em `modules/`, nunca relaxar a
validação SSRF e incluir testes para qualquer novo tracker ou contrato de API.

### Recuperação de Smart Pages e atualização do Prisma

`npm run dev` e `npm run test:e2e` regeneram o Prisma Client antes de iniciar.
Depois de atualizar o projeto, aplique as migrations com `npm run prisma:deploy`
e reinicie um servidor de desenvolvimento que já estava aberto. A migration
`20261001000000_smart_page_profile` acrescenta `theme` e `socialLinks` sem apagar
páginas, inclusive em instalações que aplicaram a primeira versão de Smart Pages.

Em desenvolvimento, `.env.local` tem precedência sobre `.env`. Verifique o banco
apontado pelo comando de migration; mudar apenas `.env` não altera uma URL já
configurada em `.env.local`. Nunca copie credenciais para mensagens de erro.

O painel oferece busca por nome/endereço, paginação, prévia do perfil antes de
salvar, indicação de alterações pendentes e recuperação da seleção de workspace.
Usuários `viewer` recebem controles de edição desabilitados; as permissões também
continuam sendo verificadas pelas APIs. Erros de banco e seleção de workspace
exibem ações de recuperação em vez de deixar o painel vazio.

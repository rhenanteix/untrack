# V2 — Contas, links e histórico

## Entregas

| Requisito             | Implementação                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Encurtador            | Links persistidos em PostgreSQL com slug aleatório de dez caracteres; redirecionamento 302 sem cache; ativação, desativação e exclusão pelo proprietário.                                                                          |
| Links compartilháveis | Página `/l/[slug]` com título, descrição, destino visível, botão para abrir, copiar e QR Code do link curto. Não expõe proprietário nem métricas.                                                                                  |
| Analytics do link     | Total de redirecionamentos, série diária de 30 dias em UTC, filtro visual de 7/30 dias, domínios de origem e categorias de dispositivo. Painel e API restritos ao proprietário.                                                    |
| Histórico na nuvem    | Limpezas, UTMs e QR Codes feitos com sessão ativa são gravados por conta em PostgreSQL. O mesmo login acessa os registros em outro navegador. Importação opcional dos dez itens locais, sem duplicar IDs, e exclusão de registros. |
| Login                 | Cadastro, login por e-mail/senha, logout, sessões persistidas e revogadas no banco, cookies HttpOnly/SameSite e Secure quando o domínio usa HTTPS.                                                                                 |

## Como testar localmente

Com Node 22.12+, npm 11+ e Docker em execução:

```bash
npm ci
npm run setup:local
npm run dev
```

1. Acesse `/cadastro` e crie sua conta com uma senha de pelo menos 12 caracteres.
2. Abra `/encurtar`, informe o destino e, opcionalmente, título e descrição.
3. Copie o link curto ou a página pública de compartilhamento.
4. Abra o link curto e consulte os cliques em `/conta` → **Ver métricas**.
5. Use limpeza, UTM ou QR Code conectado à conta; os resultados aparecem no histórico.
6. Entre com a mesma conta em outro navegador para verificar a sincronização.

Não há conta administrativa ou senha padrão. `.env.local` fica fora do Git e o setup gera segredos aleatórios. `npm run db:stop` interrompe somente o banco deste projeto; o volume preserva os dados.

## Modelo e limites

- A autenticação usa [Better Auth com Prisma](https://better-auth.com/docs/adapters/prisma); o suporte a sessões e e-mail/senha vem da biblioteca, sem criptografia de senha caseira.
- Os tokens de sessão são validados no servidor. As rotas de dados filtram por usuário; um ID de outra conta retorna 404.
- O rate limit de autenticação é persistido em PostgreSQL. O limitador das ferramentas mantém a política da V1: Upstash obrigatório em produção.
- O compartilhamento é por posse do link. O destino, título e descrição são públicos para quem receber o endereço; o histórico completo e as métricas são privados.
- Cliques representam redirecionamentos, não visitantes únicos. HEAD, prefetch e agentes conhecidos de robôs/pré-visualização são ignorados; esse filtro não identifica todos os robôs.
- A tabela de visitas guarda dia/data, domínio de origem e categoria de dispositivo; não guarda IP, user-agent bruto ou query string do referer. Sessões de autenticação têm seus próprios metadados de segurança.
- O redirecionamento não acessa o destino pelo servidor. A proteção SSRF continua no verificador de URLs da V1.
- O link de destino é imutável após a criação. Para alterá-lo, crie outro link e desative o anterior.
- Recuperação de senha por e-mail, verificação de e-mail e login social não estão configurados; dependem da evolução do fluxo de autenticação e de um provedor de envio/OAuth.

## Validação

Os E2E usam um PostgreSQL real e separado (`TEST_DATABASE_URL`, nome terminado em `_test`), aplicam as migrations sem resetar outros bancos e exercitam a UI e APIs em desktop e emulação mobile. Incluem login/logout, revogação de sessão, isolamento entre contas, origem de requisições, redirecionamento, métricas e histórico entre navegadores. A V1 permanece coberta pela suíte existente.

```bash
npm run lint
npm run test:coverage
npm run build
PLAYWRIGHT_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

No Linux/CI, instale o Chromium com `npx playwright install --with-deps chromium` e omita `PLAYWRIGHT_EXECUTABLE_PATH`. O workflow do GitHub fornece PostgreSQL para os testes.

## Publicação e hospedagem

A entrega de código foi preparada para `rhenanteix/arrume-meu-link`. O envio depende da autenticação da conta no GitHub CLI. Nenhuma credencial, banco, `.env.local`, relatório de testes ou artefato de build deve entrar no repositório.

Para usar os links na internet e ter o histórico hospedado na nuvem, publique a aplicação e configure um PostgreSQL acessível pelo servidor, Upstash, `BETTER_AUTH_SECRET` e a origem HTTPS final nas duas variáveis `NEXT_PUBLIC_APP_URL`/`BETTER_AUTH_URL`. O ambiente validado nesta etapa usa PostgreSQL local em Docker; o GitHub hospeda o código, não a aplicação.

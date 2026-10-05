# LinkOr Golden Path V1

**Data da auditoria:** 2026-10-05  
**Prioridade:** P0  
**Veredito atual:** **NO-GO**

O código e os testes unitários validam o encadeamento principal. A liberação
para usuários externos permanece bloqueada até a execução do cenário E2E em um
PostgreSQL de teste isolado. Neste ambiente, o servidor E2E não conseguiu
conectar em `localhost:55432` (`Prisma P1001`), portanto não houve prova de
runtime para redirect, cookies, formulário público e consultas contra banco
real.

## Fluxo Validado

O teste `tests/unit/golden-path-v1.test.ts` executa o caminho de serviço:

```text
Distribuição LinkedIn assinada
  -> Smart Page publicada
  -> formulário público
  -> Contact + Submission
  -> form_submit
  -> lead_created
  -> Goal "Lead Capturado"
  -> Conversion + goal_completed
```

Ele verifica que campanha, distribuição, visitor, session, ativo e origem são
preservados na conversão. Também verifica que nome e e-mail não entram nos
eventos de analytics.

## Matriz Técnica

Legenda: `[x]` validado por teste/código nesta auditoria; `[~]` possui cobertura
existente, mas requer execução E2E com banco; `[ ]` pendente de execução manual
ou E2E em ambiente de teste.

| Item | Status | Evidência |
| --- | --- | --- |
| Account | `[~]` | E2E existente cria conta e sessão; bloqueado antes da execução pelo banco indisponível. |
| Workspace | `[x]` | `tests/e2e/smart-pages-workspace.spec.ts` e testes de queries restringem por `workspaceId`. |
| Smart Page | `[~]` | Renderização, publicação e responsividade possuem E2E; execução pendente. |
| Campaign | `[x]` | Schema e serviços exigem contexto de workspace; campanha é revalidada no submit público. |
| Distribution | `[x]` | O teste Golden Path preserva `campaignAssetId=distribution_linkedin`. |
| Tracking Link | `[x]` | `tests/unit/redirect-tracking.test.ts` valida redirect e contexto assinado. |
| QR | `[x]` | O redirect de QR registra `qr_scan`, contexto e distribuição. |
| Visitor | `[x]` | O coletor persiste visitor pseudônimo e o Golden Path liga o visitante ao contato. |
| Session | `[x]` | `tests/unit/analytics-service.test.ts` valida reuso e expiração de sessão. |
| Attribution | `[x]` | Cookies assinados e revalidação de campanha/distribuição são cobertos por testes. |
| Event | `[x]` | O Golden Path grava `form_submit`, `lead_created` e `goal_completed`. |
| Goal | `[x]` | `GoalEngine` processa somente objetivos ativos e compatíveis com o evento. |
| Conversion | `[x]` | O Golden Path exige conversão com objetivo, evento, visitor, session, campanha, distribuição, ativo e origem. |
| Analytics | `[x]` | Queries contam conversões reais, não as derivam de cliques. |
| Journey | `[x]` | `tests/unit/analytics-queries.test.ts` reconstrói origem, campanha, ativo, interação e conversão na sessão. |
| Form | `[x]` | Submit rejeita página/form inativo, valida campos e suporta idempotência. |
| Contact | `[x]` | E-mail/telefone deduplicam dentro do workspace e uma nova submission não cria lead duplicado. |
| Audience | `[x]` | Resumo é atualizado após captura; as consultas são escopadas ao workspace. |

## Cenários Obrigatórios Pendentes

Executar em banco `_test` e remover os dados de teste ao fim:

- LinkedIn -> tracking link -> Smart Page -> formulário -> Contact -> Goal -> Conversion.
- WhatsApp com distribuição distinta da LinkedIn.
- QR com contexto `internal_test`, confirmando `qr_scan` e a distribuição QR.
- Acesso direto, nova sessão e teste de vazamento de attribution após expiração.
- Reload, clique duplicado e retry de submit: uma conversão por `goalId + eventId`.
- Novo submit com o mesmo e-mail: nova submission, Contact existente e sem novo `lead_created`.
- Dois workspaces: não visualizar Campaign, Event, Contact, Conversion, Goal, Analytics ou Journey de outro tenant.
- Free, trial ativo, expiração de trial e Premium; coleta deve sobreviver às limitações de visualização.
- Logout, rotas públicas, rotas privadas, link/QR inválidos, página não publicada, form inativo, goal pausado e campanha arquivada.
- Desktop em 1440/1024/768 e público mobile em 390/375, incluindo foco, teclado, labels, contraste e teclado virtual.

## Auditoria de Segurança e Dados

- O endpoint público de formulário aplica mesma origem, rate limit, limite de JSON e validação estrita de campos.
- A attribution de campanha/distribuição vem de cookie de primeira parte assinado e é revalidada no workspace da Smart Page; IDs escolhidos pelo cliente não selecionam um workspace.
- `AnalyticsEvent` armazena identidade pseudônima por hash. O coletor remove metadados de chaves sensíveis, inclusive `email`, `phone`, `whatsapp`, `name`, `message`, `token` e `password`.
- PII de formulário fica em `AudienceContact` e `SmartPageFormSubmission`, não em `AnalyticsEvent` ou na metadata analítica. Isto foi verificado pelo Golden Path.
- Não há RLS nas migrations. O isolamento atual é da aplicação, via `Actor`, permissões e filtros obrigatórios por `workspaceId`. Antes de expor acesso direto ao banco ou qualquer serviço que ignore esses serviços, definir e aplicar uma estratégia de RLS é obrigatório.
- Erros de analytics, refresh de Audience e agregação são registrados sem incluir o payload do formulário; health events cobrem recebimento, falhas e bots.

## Resultados Executados

| Comando | Resultado |
| --- | --- |
| `npm test -- --run tests/unit/golden-path-v1.test.ts` | Passou: 1 arquivo, 1 teste. |
| `npm test` | Passou: 52 arquivos, 428 testes. |
| `npm run lint` | Passou sem erros; 3 warnings pré-existentes em Smart Cards. |
| `npm run build` | Passou; TypeScript concluído e 111/111 páginas geradas. |
| `npm run test:e2e` | Bloqueado: `Prisma P1001`, PostgreSQL de teste em `localhost:55432` indisponível; 0 testes executados. |

## Bugs e Riscos

### P0

- Nenhum defeito P0 de código foi encontrado na cadeia automatizada.
- Bloqueio operacional P0: a suíte E2E não pode ser executada sem o PostgreSQL `_test`. Isto impede comprovar o Golden Path em runtime e bloqueia o GO.

### P1

- Não há RLS no banco. Isso não quebra o fluxo atual, pois a tenancy é aplicada na camada de serviço, mas é um risco se surgir qualquer consumidor com acesso direto ao banco.
- Ainda falta uma especificação E2E que crie a campanha, as três distribuições e consulte Analytics, Journey e Audience no banco real depois do submit.

### P2

- Lint possui três warnings fora do Golden Path: um `<img>` em Smart Card e dois imports não utilizados no módulo de wallet.
- O README ainda tem nomenclatura histórica de "Arrume Meu Link" e deve ser alinhado a LinkOr em trabalho documental separado.

## Próximo Gate

1. Disponibilizar PostgreSQL local ou CI com `TEST_DATABASE_URL` apontando para banco terminado em `_test` e aplicar migrations.
2. Executar `npm run test:e2e` e o checklist dos cenários pendentes.
3. Corrigir qualquer P0/P1 encontrado, limpar os dados internos e repetir `npm test`, lint, build e E2E.
4. Reavaliar este documento. Somente então o veredito pode mudar para **GO**.
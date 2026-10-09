# LinkOr Connect P0 — relatório GO / NO-GO

Data: 2026-10-08. Escopo: backend de ingestão e fundação de dados; sem rollout ou
migração automática dos coletores existentes.

## Decisão

**GO para staging e revisão do código. NO-GO para ativação imediata em produção.**

A implementação e os cenários automatizados estão validados. Ainda não há evidência
operacional de scheduler ativo, role de runtime sem bypass de RLS, secrets separados,
rate limiter distribuído e custo do novo índice na base real. Esses itens não podem
ser inferidos de testes locais. Não houve deploy nem escrita de fixtures em produção.

## Entrega

- [Diagnóstico inicial do código](design.md): autenticação, tenancy, tracking,
  sessions/visitors, campanhas/ativos, Goals, agregação, fila existente e retenção.
- [Modelo, contrato e runbook](runbook.md): política de fontes, reconciliação,
  consentimento, idempotência, estados, falhas, retenção e saúde.
- `prisma/migrations/20261008160000_connect_data_hub/migration.sql`: registry,
  receipts, tentativas, campos opcionais de histórico, constraints e FORCE RLS.
- `prisma/migrations/20261008170000_connect_reconciliation/migration.sql`: índice
  único compartilhado entre eventos legados e projeções Connect, inclusive concorrência.
- `modules/connect/`: contrato v1, provisionamento/rotação, ingestão, validação de
  associações, fila, retry/DLQ, replay auditado, consulta, métricas e retenção.
- `app/api/connect/` e `app/api/internal/connect/`: interfaces autenticadas,
  públicas limitadas e operacionais; credenciais não retornam em APIs de sessão.
- `modules/analytics/service.ts` e `aggregation.ts`: suporte a transação fornecida,
  reutilizando o motor existente para evento, Goals e buckets com ack atômico.
- `scripts/connect-source.mjs`: ferramenta operacional; arquivo privado fora do
  checkout. `scripts/test-connect.mjs`: executor com guarda de banco separado.

## Evidência de validação

| Verificação            | Resultado                                                                                      |
| ---------------------- | ---------------------------------------------------------------------------------------------- |
| `npm test`             | **475 testes passaram**, 58 arquivos; suíte PostgreSQL opt-in ignorada neste comando.          |
| `npm run test:connect` | **20 testes PostgreSQL passaram**, com migrations aplicadas somente em `arrume_meu_link_test`. |
| `npm run typecheck`    | Passou, incluindo tipos das rotas Next.                                                        |
| `npm run lint`         | 0 erros; 8 warnings preexistentes fora do Connect.                                             |
| `npm run build`        | Build de produção validado; rotas Connect compiladas.                                          |
| `git diff --check`     | Sem erros de whitespace.                                                                       |

Cobertura PostgreSQL: isolamento de fontes externas; UUID por tenant/fonte;
concorrência de ingestão; conflitos de conteúdo; RLS deny-by-default nas três tabelas
com role não proprietária/NOBYPASSRLS; chaves estrangeiras compostas; rejeição e
minimização; consentimento; atraso e ordem invertida; projeção nativa; rollback e
retry de eventos, conversões e buckets; DLQ e replay auditado; claims concorrentes;
crash/recovery e fencing; limites de tentativas; propriedade de referências;
autenticação, rotação, origem exata e CORS; HTTP → receipt → normalização;
reconciliação simultânea com o legado; retenção sem apagar histórico nativo.

Unidade: contrato/versão/campos autoritativos, propriedades e dados sensíveis,
valores monetários, limites temporais, hashes, backoff, política de fontes,
separação operacional, payload limitado, falha de persistência com 503 e respostas
sanitizadas. A suíte existente de Analytics e demais módulos passou.

O primeiro build ficou bloqueado no sandbox; a execução com acesso necessário
concluiu. Uma primeira execução de testes coincidiu com `prisma generate` do build e
falhou na importação transitória de Prisma; a repetição sem regeneração concorrente
passou integralmente. Esses fatos não foram ocultados nem classificados como falhas
de negócio. Evitar essas execuções simultâneas no mesmo checkout.

Não foram feitos testes visuais nesta entrega de backend, carga prolongada, failover
real do PostgreSQL, auditoria da produção ou nova execução completa dos fluxos E2E
legados de navegador. “Sem regressão” aqui significa que os testes automatizados
executados passaram, não garantia irrestrita sobre toda a plataforma.

## Critérios restantes de liberação

1. Aplicar as duas migrations em staging e avaliar a janela/lock do índice em volume
   representativo; usar procedimento operacional para produção.
2. Confirmar role de runtime sem SUPERUSER/BYPASSRLS e sem acesso SQL direto de
   clientes; validar RLS no pool real e nas conexões do worker.
3. Configurar secrets distintos, TLS, limiter distribuído, provisionamento seguro,
   scheduler de drain e retenção e alertas de falha/ausência do worker.
4. Observar o caminho completo com uma fonte controlada em staging. Definir quem é
   autoridade de cada evento antes de habilitar projeção nativa. Reutilizar o mesmo
   event_id do legado; não emitir duas ocorrências com IDs diferentes.
5. Aprovar retenção e política de consentimento por fonte. Planejar rotação da chave
   HMAC antes de alterar BETTER_AUTH_SECRET, conforme runbook.

## Limites deliberados do P0

- Conversion API, sites externos e conectores são consultáveis por fonte e permanecem
  isolados de totais/Goals nativos. Não se somam unidades incompatíveis.
- Não há conectores de provedores, checkpoints upstream ou promessa de completude;
  `upstreamSyncStatus` é explicitamente unknown.
- Journey não tem entidade autoritativa: journey_id permanece null. Não há resolução
  de identidade por IP nem criação de visitor por payload externo.
- APIs antigas e seu histórico permanecem. A durabilidade nova vale para os endpoints
  Connect; o caminho de agregação legado continua best-effort, e esta entrega não
  corrige retroativamente seus possíveis buckets incompletos.
- Não foram iniciados dashboards, novos módulos de atribuição/audiência nem mudanças
  de produto além da fundação solicitada.

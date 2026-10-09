# LinkOr Connect — diagnóstico e decisão P0

## Auditoria do código (2026-10-08)

- Next.js App Router + Prisma/PostgreSQL; Better Auth resolve sessão, `requireActor`
  resolve associação e workspace, `workspaceTransaction` revalida papel e permissões.
- `modules/analytics/service.ts` é o gravador universal. `AnalyticsEvent.eventId` é
  único globalmente. GoalEngine grava conversões e eventos `goal_completed` na mesma
  transação. Não há contrato versionado nem Source Registry.
- `aggregation.ts` atualiza buckets depois do commit, sem fila e sem garantia de
  retry; a falha pode deixar buckets incompletos. O novo caminho usará esse mesmo
  agregador dentro da transação. O caminho legado será preservado.
- `ClickOutbox` + `FOR UPDATE SKIP LOCKED` já usa PostgreSQL como fila durável,
  mas somente para `LinkClick`. Não há lease, backoff ou dead-letter genérica.
- Visitors são pseudônimos; sessions têm timeout; Journey é uma consulta sobre
  sessões/eventos, não uma entidade persistida. Portanto v1 não aceitará journey_id
  arbitrário. Não haverá associação por IP.
- Campanhas e ativos existem; os endpoints públicos de Smart Pages/Cards resolvem
  propriedade no servidor. `/api/events` não recebe workspace; telemetria de produto
  (`lib/analytics.ts`) também compartilha AnalyticsEvent e não é um conector.
- Não existem políticas RLS nas migrations atuais. A proteção legada depende dos
  filtros e validações do servidor. As novas tabelas terão RLS e chaves compostas.
- `retention.ts` efetivamente exclui eventos, sessões, visitantes **e agregados**;
  a documentação antiga diz que agregados são independentes e está desatualizada.
- Métricas de saúde atuais são logs condicionais de desenvolvimento/debug. Não há
  scheduler de produção versionado no repositório.

## Decisão

Criar Source Registry e uma inbox durável, não um segundo Analytics Engine. Cada
recebimento terá envelope bruto minimizado, contrato normalizado, estado, correlação,
controle de tentativas e retenção. A inbox é a fila; não haverá dual-write DB/broker.
O recebimento só responde 202 depois de persistir. Falha do banco retorna erro para
retry do produtor; não será prometida entrega quando nada foi persistido.

Fontes externas, Conversion API e conectores são normalizados e consultáveis por
fonte. No P0 ficam isolados dos totais e Goals nativos. Apenas uma fonte interna de
ativos próprios por workspace pode ser autoridade de projeção nativa. Ela usa o
mesmo gravador, GoalEngine e agregador existentes. Relatórios agregados de terceiros
não são eventos individuais e serão rejeitados. Conectores específicos, dashboards,
novos modelos de atribuição e coleta cross-domain não fazem parte deste P0.

A projeção nativa, buckets e confirmação da inbox serão atômicos. Duplicação será
resolvida por workspace + fonte + event_id, com conflito se o conteúdo mudar. Nenhuma
semelhança de horário/IP/valor será usada para juntar eventos. Reenvio de evento
legado conhecido na mesma conta não produzirá nova conversão ou bucket.

Fontes terão credenciais de servidor armazenadas somente como hash. A criação e a
rotação dessas credenciais ocorrerão em ferramenta operacional, sem expô-las em APIs
de navegador. Fontes públicas usam identificador público, allowlist de origins e
consentimento; Origin é um sinal verificável na requisição, não prova de autenticidade.
Eventos públicos nunca definem tenant nem podem publicar diretamente em Analytics.

## Contrato e processamento planejados

- Envelope v1: event_id, event_name, event_version, workspace_id, source_type,
  source_connection_id, occurred_at, received_at, processed_at, session_id,
  journey_id, campaign_id, asset_id/asset_type, properties e consent_context.
- Campos de contexto de tenant/origem/recebimento são resolvidos pelo servidor.
- Properties: schemas estritos e específicos; sem email, telefone, corpo de mensagem,
  IP, user-agent bruto, tokens, query strings ou metadata livre. Payload inválido
  terá somente resumo seguro e código de rejeição; nunca um dump integral.
- Eventos atrasados dentro de 30 dias são aceitos no bucket de occurred_at;
  timestamps mais antigos ou mais de cinco minutos no futuro são rejeitados.
- Lease recuperável, tentativas limitadas, backoff exponencial com jitter,
  dead-letter inspecionável e replay administrativo auditado.
- Retenção de bruto/rejeitados: 7 dias; normalizados/tombstones: 365 dias;
  tentativas seguem a retenção do recebimento. Sem backfill de eventos fictícios.

Este diagnóstico deriva do repositório. Não representa auditoria de configurações,
roles, scheduler ou tráfego da produção.

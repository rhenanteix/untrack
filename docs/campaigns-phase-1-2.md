# Campanhas: Fases 1 e 2

## Mapeamento existente

- `Campaign`, `CampaignChannel`, checklist, monitoramento, incidentes e aprovacoes ja existiam no Prisma e no modulo `modules/campaigns/`.
- `ShortLink` ja pertence a campanha e registra `LinkClick`; esse e o tracking reutilizado para pontos de distribuicao.
- `QrAsset` dinamico ja cria um `ShortLink` de redirect. Alterar o destino desse link preserva o QR impresso.
- `WhatsappLink` ja cria um `ShortLink` intermediario antes do redirect ao WhatsApp e registra seus cliques.
- `SmartPage`, `Product`, `UtmLink`, `AuditLog` e os recursos de workspace ja possuem isolamento por `workspaceId`.
- Checklist, verificacao HTTP/SSL/redirect e incidentes permanecem nos modulos existentes de Campanhas.

## Problemas encontrados

- A listagem usava a biblioteca administrativa generica e a criacao era somente nome e cliente.
- A pagina de detalhe apresentava seis abas tecnicas e campos administrativos.
- A UI enviava `action=channel`, mas a rota nao encaminhava a acao para `createChannel`.
- Cliques existem, mas impressoes, visitantes unicos e conversoes ainda nao sao coletados para campanhas. Esses numeros nao sao exibidos como se fossem reais.
- Monitoramento existe sob demanda; ainda nao ha agendador para verificacoes periodicas.

## Modelo aditivo

A migration `20261002010000_campaign_orchestration` preserva campanhas existentes e adiciona:

- destino principal e tipo de objetivo em `Campaign`;
- `CampaignAsset` como ponto de distribuicao;
- referencias opcionais para `ShortLink`, `QrAsset` e `WhatsappLink`.

`CampaignAsset` nao duplica Link, QR ou WhatsApp. Ele descreve o contexto comercial do recurso dentro de `Workspace -> Campaign -> Channel -> Asset`.

## Fase 1 entregue

- Campaign Builder de cinco etapas: objetivo, identificacao, periodo, destino e canais.
- Objetivo, descricao, cliente opcional, responsavel do workspace, periodo e destino principal.
- Criacao transacional de campanha e estrutura de canais, com UTM automatico e auditoria.
- Nova listagem com KPIs reais, filtros de status, cards/tabela e estado vazio.
- Dashboard com cabecalho de campanha, progresso, resultados reais/neutros, canais, saude e atividade recente.
- Navegacao: Visao geral, Distribuicao, Desempenho, Monitoramento e Historico.

## Fase 2 entregue

- Modal pesquisavel para adicionar canais com tracking automatico.
- Pontos de distribuicao para link, QR dinamico e WhatsApp.
- Links de campanha usam o servico existente de links e associacao de campanha.
- QR usa o servico existente em modo dinamico, portanto o destino pode mudar sem reimpressao.
- WhatsApp usa o link intermediario existente para registrar clique antes do redirect.
- Distribuicao agrupa pontos por canal e permite copiar, abrir QR e testar o destino.

## Componentes alterados

- `components/untrack/campaign-builder.tsx`: wizard.
- `components/untrack/campaigns-list.tsx`: listagem de Campanhas.
- `components/untrack/campaign-dashboard.tsx`: dashboard, distribuicao e operacao.
- `app/untrack/campaigns/page.tsx` e `app/untrack/campaigns/[id]/page.tsx`: rotas usando as novas superficies.
- `modules/campaigns/service.ts` e `app/api/campaigns/route.ts`: orquestracao, validacao e APIs.

## Proximas fases

1. Eventos analiticos com `campaignId`, `channelId` e `assetId`, visitantes unicos, impressoes e conversoes.
2. Scheduler de monitoramento e entrega de alertas.
3. Metas, conversoes, duplicacao seletiva, templates e insights deterministicos.
4. Kit exportavel com PNG/SVG/ZIP, sem duplicar os recursos existentes.

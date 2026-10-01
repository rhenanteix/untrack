# Área autenticada — navegação e bibliotecas

As rotas existentes usam um único `WorkspaceShell`, montado pelo layout raiz
através de `AuthenticatedFrame`. Navegar entre `/conta` e `/untrack/*` mantém
o seletor e a carga de associação ao workspace. Trocar o workspace continua
validando a associação no servidor e recarrega os dados do contexto escolhido.
O cabeçalho público não aparece nessas rotas.

- `/conta`: visão geral com contagens persistidas, cliques dos últimos 30 dias,
  checklist derivado dos registros, ativos recentes, auditoria e incidentes
  confirmados ainda não resolvidos. Não calcula tendências artificiais.
- `/conta/perfil`: perfil e histórico detalhado que antes dominavam o dashboard.
- `/untrack`: mantém compatibilidade, redirecionando para a visão geral.
- `/untrack/short-links` e `/untrack/campaigns`: bibliotecas com busca, filtros
  e paginação no servidor. `search`, `status`, `clientId`, `campaignId` (links),
  `from`, `to` e `page` ficam na URL. Datas são inclusivas em UTC. Os detalhes
  recebem um `returnTo` restrito à rota interna da respectiva biblioteca.
- `/untrack/smart-pages`: biblioteca; `?create=1` abre a criação e `?edit=id`
  abre o editor, mantendo a busca na URL. Modelos e personalizações existentes
  permanecem disponíveis, sem substituir conteúdo salvo por exemplos.

## Permissões e operações

Todas as consultas continuam filtradas pelo workspace resolvido da sessão no
servidor. `workspaceId` em parâmetros de busca não concede acesso. Leitores não
veem ações de criação/alteração. Controles administrativos seguem o papel da
associação, mantendo as verificações de autorização nas APIs existentes.

`PATCH /api/short-links/bulk` aceita `{ ids: string[], isActive: boolean }`,
com 1–100 IDs únicos. Na transação do workspace, a associação e a permissão são
revalidadas; todos os IDs precisam ser links digitais do mesmo workspace. Uma
falha rejeita a operação inteira. A alteração gera auditoria e invalida o cache
de redirecionamento. O banco continua sendo a fonte de verdade.

A exportação CSV contém somente os registros selecionados da página atual;
campos que poderiam iniciar fórmulas de planilha são neutralizados. As opções
dos filtros de cliente e campanha mostram até 100 registros por nome; a busca
principal continua paginada no servidor.

## Editor e resultados

As abas Perfil, Aparência, Links e Resultados usam a semântica de tabs, com
setas, Home e End. No desktop a prévia acompanha o editor; no celular há uma
alternância Editar/Prévia. A galeria antecede a personalização avançada. A barra
de salvamento informa alterações pendentes, salvamento, sucesso ou erro.

Cada botão escolhe explicitamente URL externa ou link gerenciado. Os cartões
de links são recolhíveis e preservam os controles de ordenação por teclado.
Não há simulação de versões: alterações salvas numa página publicada alteram
essa página. A mudança de slug continua avisando sobre o endereço anterior.

Resultados carregam ao abrir a aba, com períodos de 7, 30 e 90 dias, atualização
manual e horário da última carga bem-sucedida. Erro, espera e zero confirmado
são estados separados. Atualizar métricas não bloqueia os demais controles.
CTR e visitantes únicos têm sua definição apresentada junto aos resultados.

## Operação

Este redesenho não exige novas variáveis ou dependências. A migration
`20261001020000_campaign_runtime_schema` completa campos e tabelas de Campanhas
que já estavam no schema e nos serviços, mas faltavam no histórico de migrations.
Ela preserva campanhas existentes, inicializando `updatedAt` com `createdAt`.
Execute `npm run prisma:deploy` no ambiente de destino antes da atualização. Usa a
autenticação, o PostgreSQL/Prisma e a configuração opcional de cache existentes.
O premium preparado anteriormente permanece sem cobrança automática.

Os testes `workspace-navigation.spec.ts` e `smart-pages-workspace.spec.ts`
exercitam desktop e celular com banco de teste isolado, cobrindo navegação,
filtros, edição, publicação, uploads, permissões, isolamento entre workspaces,
erros recuperáveis, prévia e resultados. As capturas são gravadas em
`test-results/`; a suíte usa `TEST_DATABASE_URL` terminado em `_test` e aceita
`PLAYWRIGHT_EXECUTABLE_PATH` para usar um Chrome local.

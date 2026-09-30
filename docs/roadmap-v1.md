# Auditoria da V1

Revisão de 30/09/2026. Escopo: os 12 itens da V1. V2–V4 permanecem fora desta entrega.

| Item                 | Situação encontrada                                            | Entrega e validação                                                                                                                                                                                                                       |
| -------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing page         | Implementada                                                   | Homepage, conteúdo explicativo, navegação mobile e responsividade cobertos por E2E.                                                                                                                                                       |
| Limpeza de URL       | Implementada                                                   | API principal e alias testados; preservação de parâmetros legítimos e repetidos. Limite da interface alinhado aos 4.096 caracteres da API.                                                                                                |
| Detecção de tracking | Implementada                                                   | Categorias selecionáveis, trackers por nome/prefixo e estatísticas por ocorrência testados.                                                                                                                                               |
| Copiar               | Implementado, sem tratamento de erro                           | Sucesso e negação do clipboard testados; falhas agora exibem orientação para cópia manual.                                                                                                                                                |
| Abrir                | Implementado                                                   | Destino, nova aba e proteção `noopener noreferrer` testados; eventos também instrumentados no histórico e UTM.                                                                                                                            |
| QR Code              | Implementado, com inconsistência após editar o campo           | Imagem, cópia e compartilhamento passam a usar a URL da geração concluída; download PNG, carregamento e falha de rede cobertos.                                                                                                           |
| UTM Builder          | Implementado, sem tratamento de falha de rede                  | Carregamento, recuperação de erro, preservação do destino, encoding e abertura da campanha testados.                                                                                                                                      |
| Validação            | Implementada                                                   | Schemas, erros HTTP, JSON inválido, SSRF e rejeição de localhost testados.                                                                                                                                                                |
| Histórico local      | Implementado, vulnerável a dados corrompidos/storage bloqueado | Validação dos registros e isolamento de falhas; limite de dez itens, persistência após reload e exclusão testados.                                                                                                                        |
| SEO                  | Implementado                                                   | Títulos, descrições, canonical, Open Graph, Twitter, JSON-LD, robots e sitemap existentes. Metadados básicos e rotas SEO verificados por E2E.                                                                                             |
| Analytics            | Parcial                                                        | Eventos do navegador eram apenas DOM events. Agora chegam a `/api/analytics`, com allowlist de eventos/caminhos, rate limit e sem URLs submetidas. Eventos já registrados pelas APIs não são duplicados. Trabalho assíncrono usa `after`. |
| Testes               | Existiam, mas não iniciavam na instalação local                | Vite declarado, testes de API/analytics/histórico e E2E adicionados; CI incluído. Servidor E2E isolado na porta 3100 e em `.next-e2e`.                                                                                                    |

## Analytics

- `ANALYTICS_CONSOLE=true` permite inspecionar eventos no terminal de desenvolvimento.
- `ANALYTICS_PERSISTENCE=prisma` habilita a persistência opcional em PostgreSQL. A migration inicial está versionada em `prisma/migrations`.
- Com as duas opções desativadas, os eventos são aceitos e descartados; não há armazenamento oculto.
- Os eventos contêm apenas nome, data e metadados técnicos controlados. Query strings, URLs dos usuários e histórico não são enviados ao coletor.
- A coleta é best effort: indisponibilidade de rede, rate limit ou erro do sink não bloqueia as ferramentas.
- Dashboard, contas e relatórios de campanhas pertencem à V3 e não foram implementados nesta revisão.

## Configuração ainda necessária para produção

- Definir `NEXT_PUBLIC_APP_URL` com o domínio definitivo para canonical e sitemap.
- Configurar as duas variáveis Upstash. Sem elas, as APIs retornam 503 em produção por projeto.
- Se desejar analytics persistente, fornecer PostgreSQL, gerar o Prisma Client e executar `npm run prisma:deploy`. A integração foi testada com mock; não foi validada com um banco real nesta revisão.
- O workflow de CI foi criado localmente; sua execução remota depende de enviar o código ao GitHub.

## Como repetir a validação

Resultado local desta revisão:

- 65 testes unitários e de API aprovados.
- 60 cenários E2E validados em desktop e emulação mobile: 52 passaram na execução inicial e os oito afetados pelos seletores/normalização do canonical passaram após o ajuste dos testes.
- Cobertura de 100% em statements, branches, functions e lines dos oito arquivos de `modules/**`.
- ESLint, TypeScript e build de produção aprovados.
- Endpoint local de analytics confirmado com HTTP 204 e evento registrado no console.

```bash
npm run lint
npm run test:coverage
npm run build
npm run test:e2e
```

Use Node 22.12+ e npm 11+. Em máquinas cujo sistema não seja compatível com o Chromium fornecido pelo Playwright, indique um Chrome instalado:

```bash
PLAYWRIGHT_EXECUTABLE_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm run test:e2e
```

Os testes de desktop e mobile usam Chromium/Chrome; o perfil iPhone é emulação, não Safari real. A cobertura configurada mede `modules/**`, não toda a aplicação. A ausência de avisos de hidratação é verificada em navegador sem extensões.

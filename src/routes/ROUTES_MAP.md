# Mapa de Rotas e Layouts (`src/routes`)

Fonte de verdade para paths públicos: `src/routeTree.gen.ts` (`FileRoutesByTo` e `FileRoutesByPath`).

## Hierarquia de layouts

1. `__root.tsx` (layout raiz global)
   - Aplica tema (`useThemeStore`) e moldura visual base da aplicação.
   - Envolve todas as rotas com `ErrorBoundary` + `<Outlet />`.

2. `/_app` (layout autenticado pathless)
   - `beforeLoad` valida sessão com `orpc.auth.me`.
   - Sem sessão: `redirect` para `/login`.
   - Com sessão: renderiza `AppShell` + `<Outlet />`.
   - Registra listeners globais de realtime: `useTerminalEvents` e `useTaskSyncEvents`.

3. Layouts de página (por rota)
   - Quase todas as páginas internas usam `PageShell` para header/descrição/ícone e área de conteúdo.
   - Exceção relevante: overview e editor de tarefa usam header próprio; os arquivos dinâmicos despacham shapes canônicos e legados por aridade.

## Rotas file-based

| Arquivo | Route ID | Path público (`to`) | Layout efetivo |
|---|---|---|---|
| `src/routes/__root.tsx` | `__root__` | — | Root global (`ErrorBoundary`) |
| `src/routes/login.tsx` | `/login` | `/login` | `__root` + `PageShell` (sem `AppShell`) |
| `src/routes/_app.tsx` | `/_app` | `/` (pathless) | `__root` + `AppShell` |
| `src/routes/_app/index.tsx` | `/_app/` | `/` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/tarefas/index.tsx` | `/_app/tarefas/` | `/tarefas` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/tarefas/$taskId/index.tsx` | `/_app/tarefas/$taskId/` | `/tarefas/$featureId?projectId=...` | Dispatcher de feature; overview legado redireciona ao canônico |
| `src/routes/_app/tarefas/$taskId/$file.tsx` | `/_app/tarefas/$taskId/$file` | `/tarefas/$featureId/$taskId` | Overview canônico; arquivo legado redireciona ao canônico |
| `src/routes/_app/tarefas/$taskId/$file_/$canonicalFile.tsx` | `/_app/tarefas/$taskId/$file_/$canonicalFile` | `/tarefas/$featureId/$taskId/$file` | Editor canônico desaninhado com header próprio |
| `src/routes/_app/vault/index.tsx` | `/_app/vault/` | `/vault` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/vault/$fileName/index.tsx` | `/_app/vault/$fileName/` | `/vault/$fileName` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/media/index.tsx` | `/_app/media/` | `/media` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/media/$fileName/index.tsx` | `/_app/media/$fileName/` | `/media/$fileName` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/mostruario/index.tsx` | `/_app/mostruario/` | `/mostruario` | `__root` + `AppShell` + `PageShell` (lista tarefas com artefatos `.html`/`.pdf`; clicar no artefato abre no SO) |
| `src/routes/_app/projetos/index.tsx` | `/_app/projetos/` | `/projetos` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/projetos/novo/index.tsx` | `/_app/projetos/novo/` | `/projetos/novo` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/projetos/$projetoId/index.tsx` | `/_app/projetos/$projetoId/` | `/projetos/$projetoId` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/sistema.tsx` | `/_app/sistema` | `/sistema` | `__root` + `AppShell` + `PageShell` (subpágina de `/configuracoes`) |
| `src/routes/_app/skills/index.tsx` | `/_app/skills/` | `/skills` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/skills/$slug/index.tsx` | `/_app/skills/$slug/` | `/skills/$slug` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/agents/index.tsx` | `/_app/agents/` | `/agents` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/agents/$slug/index.tsx` | `/_app/agents/$slug/` | `/agents/$slug` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/prompts/index.tsx` | `/_app/prompts/` | `/prompts` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/terminals/index.tsx` | `/_app/terminals/` | `/terminals` | `__root` + `AppShell` + `PageShell` (lista primária dos agents abertos; tabs/workspaces são secundários) |
| `src/routes/_app/terminals/$paneId/index.tsx` | `/_app/terminals/$paneId/` | `/terminals/$paneId` | `__root` + `AppShell` + `PageShell` (lista + conversa no desktop; conversa no mobile; transcript exato do pane) |
| `src/routes/_app/executar/index.tsx` | `/_app/executar/` | `/executar` | Redirect para `/terminals` |
| `src/routes/_app/executar/$executionId/index.tsx` | `/_app/executar/$executionId/` | `/executar/$executionId` | Arquivo somente leitura de sessão/run legado; jobs atuais mantêm cancelamento e repetição |
| `src/routes/_app/radar/index.tsx` | `/_app/radar/` | `/radar` | Redirect legado para `/terminals` |
| `src/routes/_app/radar/$paneId/index.tsx` | `/_app/radar/$paneId/` | `/radar/$paneId` | Redirect legado para `/terminals/$paneId` |
| `src/routes/_app/configuracoes.tsx` | `/_app/configuracoes` | `/configuracoes` | `__root` + `AppShell` + `PageShell` |

## Estrutura de pastas em `src/routes`

- Pastas/arquivos com prefixo `-` (ex.: `-components`, `-utils`) **não criam rota**; são suporte da feature.
- Segmento `/_app` é estrutural (layout autenticado), então não aparece no path final.
- Rotas dinâmicas atuais:
  - `/projetos/$projetoId`
  - `/tarefas/$featureId?projectId=<uuid>` lista a feature; `sem-feature` representa vínculo nulo.
  - `/tarefas/$featureId/$taskId` abre o overview e valida a relação feature/projeto.
  - `/tarefas/$featureId/$taskId/$file` abre o `.md` ativo.
  - `/tarefas/$taskId` e `/tarefas/$taskId/$file` permanecem como links legados e redirecionam por `replace`.
  - `/vault/$fileName` (`$fileName` é o nome do `.md` solto, ex. `notas.md` — não é uma task)
  - `/media/$fileName` (`$fileName` é o asset em `.koworker/medias/`; `?projectId` no search identifica o projeto)
  - `/skills/$slug` (`$slug` é o slug da skill, ex. `commit` — edita o `SKILL.md` da pasta dona)
  - `/agents/$slug` (`$slug` é o slug do agent, ex. `planner` — edita o `.md` da pasta dona)
  - `/terminals/$paneId` (`$paneId` é o pane do kw-terminal, ex. `w5E:p3` — some junto com o pane)
  - `/radar` e `/radar/$paneId` permanecem como links legados (push já entregue) e redirecionam por `replace`.

## Evidências verificadas

- Layout raiz e outlet global: `src/routes/__root.tsx`
- Guarda de autenticação e `AppShell`: `src/routes/_app.tsx`
- Definição de paths: arquivos `createFileRoute(...)` dentro de `src/routes/_app/**` e `src/routes/login.tsx`
- Composição específica de layout por página: imports/uso de `PageShell` e `TaskPageLayout` nos arquivos de rota.

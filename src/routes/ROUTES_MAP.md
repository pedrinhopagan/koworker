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
   - Exceção relevante: detalhe de tarefa (`/tarefas/$taskId/$file`) usa header próprio (sem `PageShell`); o índice `/tarefas/$taskId` só redireciona para o arquivo ativo.

## Rotas file-based

| Arquivo | Route ID | Path público (`to`) | Layout efetivo |
|---|---|---|---|
| `src/routes/__root.tsx` | `__root__` | — | Root global (`ErrorBoundary`) |
| `src/routes/login.tsx` | `/login` | `/login` | `__root` + `PageShell` (sem `AppShell`) |
| `src/routes/_app.tsx` | `/_app` | `/` (pathless) | `__root` + `AppShell` |
| `src/routes/_app/index.tsx` | `/_app/` | `/` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/tarefas/index.tsx` | `/_app/tarefas/` | `/tarefas` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/tarefas/$taskId/index.tsx` | `/_app/tarefas/$taskId/` | `/tarefas/$taskId` | `__root` + `AppShell` (só redirect → `$file`; empty-state se sem arquivos) |
| `src/routes/_app/tarefas/$taskId/$file.tsx` | `/_app/tarefas/$taskId/$file` | `/tarefas/$taskId/$file` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/vault/index.tsx` | `/_app/vault/` | `/vault` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/vault/$fileName/index.tsx` | `/_app/vault/$fileName/` | `/vault/$fileName` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/media/index.tsx` | `/_app/media/` | `/media` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/media/$fileName/index.tsx` | `/_app/media/$fileName/` | `/media/$fileName` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/mostruario/index.tsx` | `/_app/mostruario/` | `/mostruario` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/mostruario/$taskFolder/$fileName/index.tsx` | `/_app/mostruario/$taskFolder/$fileName/` | `/mostruario/$taskFolder/$fileName` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/projetos/index.tsx` | `/_app/projetos/` | `/projetos` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/projetos/novo/index.tsx` | `/_app/projetos/novo/` | `/projetos/novo` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/projetos/$projetoId/index.tsx` | `/_app/projetos/$projetoId/` | `/projetos/$projetoId` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/agenda/index.tsx` | `/_app/agenda/` | `/agenda` | `__root` + `AppShell` + `AgendaDndWrapper` + `PageShell` |
| `src/routes/_app/sistema.tsx` | `/_app/sistema` | `/sistema` | `__root` + `AppShell` + `PageShell` (subpágina de `/configuracoes`) |
| `src/routes/_app/skills/index.tsx` | `/_app/skills/` | `/skills` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/skills/$slug/index.tsx` | `/_app/skills/$slug/` | `/skills/$slug` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/agents/index.tsx` | `/_app/agents/` | `/agents` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/agents/$slug/index.tsx` | `/_app/agents/$slug/` | `/agents/$slug` | `__root` + `AppShell` (header próprio, sem `PageShell`) |
| `src/routes/_app/prompts/index.tsx` | `/_app/prompts/` | `/prompts` | `__root` + `AppShell` + `PageShell` |
| `src/routes/_app/configuracoes.tsx` | `/_app/configuracoes` | `/configuracoes` | `__root` + `AppShell` + `PageShell` |

## Estrutura de pastas em `src/routes`

- Pastas/arquivos com prefixo `-` (ex.: `-components`, `-utils`) **não criam rota**; são suporte da feature.
- Segmento `/_app` é estrutural (layout autenticado), então não aparece no path final.
- Rotas dinâmicas atuais:
  - `/projetos/$projetoId`
  - `/tarefas/$taskId` (redirect → `/tarefas/$taskId/$file`)
  - `/tarefas/$taskId/$file` (`$file` é o nome do `.md` ativo da tarefa, ex. `plan.md` — match exato, sem slug)
  - `/vault/$fileName` (`$fileName` é o nome do `.md` solto, ex. `notas.md` — não é uma task)
  - `/media/$fileName` (`$fileName` é o asset em `.koworker/medias/`; `?projectId` no search identifica o projeto)
  - `/mostruario/$taskFolder/$fileName` (`$taskFolder` é o id curto da tarefa, `$fileName` o artefato; `?projectId` no search)
  - `/skills/$slug` (`$slug` é o slug da skill, ex. `commit` — edita o `SKILL.md` da pasta dona)
  - `/agents/$slug` (`$slug` é o slug do agent, ex. `planner` — edita o `.md` da pasta dona)

## Evidências verificadas

- Layout raiz e outlet global: `src/routes/__root.tsx`
- Guarda de autenticação e `AppShell`: `src/routes/_app.tsx`
- Definição de paths: arquivos `createFileRoute(...)` dentro de `src/routes/_app/**` e `src/routes/login.tsx`
- Composição específica de layout por página: imports/uso de `PageShell`, `TaskPageLayout` e `AgendaDndWrapper` nos arquivos de rota.

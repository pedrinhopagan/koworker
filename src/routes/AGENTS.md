# ROUTES AGENTS

## OBJETIVO

Manter as rotas TanStack Router alinhadas ao estado real de `src/routes`.

## ESTRUTURA REAL (ATUAL)

```text
routes/
├── __root.tsx
├── _app.tsx
├── login.tsx
├── _app/
│   ├── index.tsx
│   ├── configuracoes.tsx
│   ├── sistema.tsx
│   ├── agents/
│   │   ├── index.tsx
│   │   ├── $slug/index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── prompts/
│   │   ├── index.tsx
│   │   └── -components/
│   ├── skills/
│   │   ├── index.tsx
│   │   ├── $slug/index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── vault/
│   │   ├── index.tsx
│   │   ├── $fileName/index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── media/
│   │   ├── index.tsx
│   │   └── $fileName/index.tsx
│   ├── mostruario/
│   │   └── index.tsx
│   ├── tarefas/
│   │   ├── index.tsx
│   │   ├── $taskId/index.tsx   (só redirect → $file)
│   │   ├── $taskId/$file.tsx   (detalhe da tarefa; arquivo .md ativo na URL)
│   │   ├── -components/
│   │   └── -utils/
│   └── projetos/
│       ├── index.tsx
│       ├── novo/index.tsx
│       ├── $projetoId/index.tsx
│       ├── -components/
│       └── -utils/
└── ROUTES_MAP.md
```

## ROTAS PÚBLICAS

- `/login`
- `/`
- `/tarefas`
- `/tarefas/$taskId` (redirect → `/tarefas/$taskId/$file`)
- `/tarefas/$taskId/$file`
- `/projetos`
- `/projetos/novo`
- `/projetos/$projetoId`
- `/skills`
- `/skills/$slug`
- `/agents`
- `/agents/$slug`
- `/prompts`
- `/vault`
- `/vault/$fileName`
- `/media`
- `/media/$fileName`
- `/mostruario`
- `/sistema`
- `/configuracoes`

## LAYOUTS E GUARDA

- `__root.tsx`: layout global + `ErrorBoundary`.
- `_app.tsx`: layout autenticado (pathless), valida sessão (`orpc.auth.me`) e redireciona para `/login` sem autenticação.
- Rotas internas usam `AppShell`; páginas usam `PageShell` quando aplicável.
- Exceção: detalhe de tarefa (`/tarefas/$taskId/$file`) usa header próprio (sem `PageShell`); `/tarefas/$taskId` só redireciona para o arquivo ativo.

## REGRAS

- File-based routing com `createFileRoute`.
- Pastas com prefixo `-` (`-components`, `-utils`) são suporte e **não** criam rota.
- Segmento `/_app` é estrutural e não aparece no path público.
- Dados: ORPC + TanStack Query.
- Realtime: listeners globais no layout autenticado.

## FONTE DE VERDADE

- Conferir rotas geradas em `src/routeTree.gen.ts`.
- Referência humana de navegação/layout: `src/routes/ROUTES_MAP.md`.

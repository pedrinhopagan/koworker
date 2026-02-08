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
│   ├── agenda/
│   │   ├── index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── configuracoes.tsx
│   ├── skills/
│   │   ├── index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── tarefas/
│   │   ├── index.tsx
│   │   ├── $taskId/index.tsx
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
- `/tarefas/$taskId`
- `/projetos`
- `/projetos/novo`
- `/projetos/$projetoId`
- `/agenda`
- `/skills`
- `/configuracoes`

## LAYOUTS E GUARDA

- `__root.tsx`: layout global + `ErrorBoundary`.
- `_app.tsx`: layout autenticado (pathless), valida sessão (`orpc.auth.me`) e redireciona para `/login` sem autenticação.
- Rotas internas usam `AppShell`; páginas usam `PageShell` quando aplicável.
- Exceção: `/tarefas/$taskId` usa layout próprio (`TaskPageLayout`).

## REGRAS

- File-based routing com `createFileRoute`.
- Pastas com prefixo `-` (`-components`, `-utils`) são suporte e **não** criam rota.
- Segmento `/_app` é estrutural e não aparece no path público.
- Dados: ORPC + TanStack Query.
- Realtime: listeners globais no layout autenticado.

## FONTE DE VERDADE

- Conferir rotas geradas em `src/routeTree.gen.ts`.
- Referência humana de navegação/layout: `src/routes/ROUTES_MAP.md`.

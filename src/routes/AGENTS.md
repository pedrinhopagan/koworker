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
│   │   ├── $taskId/index.tsx   (dispatcher: feature ou overview legado)
│   │   ├── $taskId/$file.tsx   (dispatcher: overview canônico ou arquivo legado)
│   │   ├── $taskId/$file_/$canonicalFile.tsx (arquivo canônico desaninhado)
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
- `/tarefas/$featureId?projectId=<uuid>`
- `/tarefas/$featureId/$taskId`
- `/tarefas/$featureId/$taskId/$file`
- Links legados `/tarefas/$taskId` e `/tarefas/$taskId/$file` redirecionam por `replace`.
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
- Detalhes usam header próprio; dispatchers por aridade evitam colisão entre shapes legado e canônico.

## REGRAS

- File-based routing com `createFileRoute`.
- Pastas com prefixo `-` (`-components`, `-utils`) são suporte e **não** criam rota.
- Segmento `/_app` é estrutural e não aparece no path público.
- Dados: ORPC + TanStack Query.
- Realtime: listeners globais no layout autenticado.

## FONTE DE VERDADE

- Conferir rotas geradas em `src/routeTree.gen.ts`.
- Referência humana de navegação/layout: `src/routes/ROUTES_MAP.md`.

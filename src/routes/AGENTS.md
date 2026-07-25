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
│   ├── fontes.tsx
│   ├── kw-terminal.tsx
│   ├── executar/
│   │   ├── index.tsx
│   │   ├── $executionId/index.tsx
│   │   └── -components/
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
│       ├── $projetoId/docs/$.tsx   (splat de documentos do projeto)
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
- `/projetos/$projetoId/docs/$`
- `/executar`
- `/executar/$executionId`
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
- `/fontes`
- `/kw-terminal`

## LAYOUTS E GUARDA

- `__root.tsx`: layout global + `ErrorBoundary`.
- `_app.tsx`: layout autenticado (pathless), valida sessão (`orpc.auth.me`) e redireciona para `/login` sem autenticação.
- Rotas internas usam `AppShell`; páginas usam `PageShell` quando aplicável.
- Detalhes usam header próprio; dispatchers por aridade evitam colisão entre shapes legado e canônico.

## CODE SPLITTING

Rotas pesadas ficam em dois arquivos: o crítico (`index.tsx`) só declara `createFileRoute` com o que o
router precisa antes de baixar o chunk (`validateSearch`, `beforeLoad`, `loader`, `params`), e o
`index.lazy.tsx` irmão declara `createLazyFileRoute` com o componente e todo o resto do código da
página. Nunca mova `validateSearch`, `beforeLoad` ou `loader` para o arquivo `.lazy`.

Já divididas: `fontes`, `executar/`, `executar/$executionId/`, `projetos/$projetoId/docs/$`,
`vault/`, `vault/$fileName/`, `tarefas/$taskId/`, `tarefas/$taskId/$file`,
`tarefas/$taskId/$file_/$canonicalFile`, `skills/$slug/`, `agents/$slug/`, `media/`,
`media/$fileName/`, `mostruario/`.

## REGRAS

- File-based routing com `createFileRoute`.
- Rota pesada ganha `.lazy.tsx` irmão com `createLazyFileRoute`; depois rodar `tsr generate`.
- Pastas com prefixo `-` (`-components`, `-utils`) são suporte e **não** criam rota.
- Segmento `/_app` é estrutural e não aparece no path público.
- Dados: ORPC + TanStack Query.
- Realtime: listeners globais no layout autenticado.

## FONTE DE VERDADE

- Conferir rotas geradas em `src/routeTree.gen.ts`.
- Referência humana de navegação/layout: `src/routes/ROUTES_MAP.md`.

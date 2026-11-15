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
│   ├── conversa.tsx       (redirect para /chat)
│   ├── chat/
│   │   ├── index.tsx
│   │   ├── index.lazy.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── terminals/
│   │   ├── index.tsx
│   │   ├── $paneId/index.tsx
│   │   ├── history/index.tsx
│   │   ├── history/$cli/$sessionId/index.tsx
│   │   ├── -components/
│   │   └── -utils/
│   ├── shells/
│   │   ├── index.tsx
│   │   ├── $shellId/index.tsx
│   │   └── -components/
│   ├── arquivo/
│   │   └── index.tsx           (leitor de arquivo citado: ?path=&line=)
│   ├── radar/               (redirects legados para /chat)
│   ├── executar/
│   │   ├── index.tsx
│   │   ├── $executionId/index.tsx
│   │   └── -components/
│   ├── agents/
│   │   ├── index.tsx
│   │   ├── $slug/index.tsx
│   │   ├── -components/
│   │   └── -utils/
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
- `/executar`: redirect legado para `/chat`
- `/executar/$executionId`
- `/skills`
- `/skills/$slug`
- `/agents`
- `/agents/$slug`
- `/vault`
- `/vault/$fileName`
- `/media`
- `/media/$fileName`
- `/mostruario`
- `/sistema`
- `/configuracoes`
- `/fontes`
- `/chat` cria conversa nativa do Codex; `/chat?id=<uuid>` retoma a conversa persistida.
  A seção Chat reúne os indicadores de atividade e espera, incluindo sessões do terminal e conversas nativas. Shells e Painel ficam fora da navegação, das abas e dos atalhos de projeto; suas rotas antigas redirecionam para Chat ou Projetos. No mobile, a barra inferior acompanha o chat e se recolhe quando o teclado abre.
  `/conversa` redireciona para `/chat` preservando `id` ou `paneId`.
  A sidebar filtra históricos pelo projeto selecionado e importa threads do Codex por conta.
  Agents abertos de todos os projetos ficam no topo; o histórico abaixo mostra as três conversas
  mais recentes e expande até sair da rota. `/chat?paneId=<id>` abre a conversa ou
  o terminal existente. Codex usa `thread/read` e o stream `conversationPane`, sem retomar o CLI;
  a apresentação mantém a ordem dos itens nativos e recebe outras CLIs por adapter. Desktop usa sidebar; mobile usa páginas de lista, conversa e criação (`/chat?view=new`), com volta para a lista.
- `/terminals`: redirect legado para `/chat`
- `/terminals/$paneId`: redirect legado para `/chat?paneId=<paneId>`
- `/terminals/history` — conversas antigas de Claude e Codex lidas do disco, filtradas por projeto, CLI e busca
- `/terminals/history/$cli/$sessionId` — a conversa antiga em leitura, com retomada em pane novo
- `/shells`: redirect legado para `/chat`, preservando panes em `?tab=agent:<paneId>`
- `/shells/$shellId`: redirect legado para `/chat`
- `/painel`: redirect legado para `/projetos`
- `/painel/$projetoId`: redirect legado para `/projetos/$projetoId`
- `/arquivo?path=<absoluto>&line=<n>` — leitor de arquivo citado numa conversa (markdown renderizado ou código com linha destacada); só arquivos dentro de projeto cadastrado ou worktree de tarefa, é o destino dos links de arquivo quando o cliente não está na máquina do backend
- Links legados `/radar` e `/radar/$paneId` redirecionam para `/chat` por `replace`, preservando o pane.

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
`media/$fileName/`, `mostruario/`, `terminals/history/`,
`terminals/history/$cli/$sessionId/`, `shells/`, `arquivo/`, `chat/`.

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

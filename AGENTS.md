# KOWORK KNOWLEDGE BASE

**Generated:** 2026-01-29

## VISÃO GERAL

Kowork v2: gestão de projetos e tarefas com apoio de AI Coding Agents. Stack Bun + ORPC + Kysely + SQLite no backend e React 19 + TanStack Router/Query + Tailwind + Radix no frontend.

## ESTRUTURA

```
src/
├── api/                 # ORPC, auth, schemas, db, pubsub
├── routes/              # TanStack Router (file-based)
├── components/          # Componentes de UI (shadcn + base)
├── hooks/
├── lib/
├── stores/
├── types/
├── cli/                 # CLI Kowork (acesso direto ao DB)
```

## ONDE PROCURAR

| Tarefa | Local | Notas |
|---|---|---|
| **Router ORPC** | `src/api/router.ts` | Único router que agrega subrouters |
| **Schemas** | `src/api/schemas/` | Zod para input/output |
| **DB** | `src/api/db/` | Kysely + @lobomfz/db |
| **PubSub** | `src/api/pubsub/` | Eventos em tempo real |
| **Rotas** | `src/routes/` | TanStack Router |
| **UI base** | `src/components/ui/` | shadcn (preset Lyra) |
| **CLI** | `src/cli/` | Comandos que atualizam tasks |

## ALIASES

```ts
@/* → src/*
```

## CONVENÇÕES GERAIS

- **Idioma**: pt-BR em código e mensagens
- **TypeScript**: inferência automática; tipos explícitos só quando necessário
- **Exports**: apenas named exports (nunca default, exceto endpoints)
- **Comentários**: proibidos
- **DRY**: procurar util existente antes de criar novo
- **UI**: usar `<Title>` e `<Text>` ao invés de `<h1>`/`<p>`
- **Condição**: usar `&&` em vez de ternário para render condicional
- **Ícones**: somente `lucide-react`

## VALIDAÇÃO

- **Zod** é o padrão de schemas (API e UI)
- **Arktype** apenas onde for necessário pelo `@lobomfz/db` (schema de DB)

## ROUTER ORPC

- Router único em `src/api/router.ts`, agregando subrouters:
  - `router.projects.create` / `router.tasks.update` etc
- `wsRouter` separado em `src/api/router.ts` para streams

## BANCO DE DADOS

- **SQLite** tradicional via `@lobomfz/db` + Kysely
- **IDs**: `uuid` armazenado como `TEXT` (gerado na aplicação)
- **snake_case** no DB, `camelCase` no TS
- **JSON**: colunas JSON são `TEXT` com `JSON.stringify/parse`
- **Soft delete**: apenas `projects` e `tasks` possuem `deleted_at`

## ENTIDADES

### projects
- `id` (uuid)
- `name`
- `description?`
- `color` (hex, default `#000000`)
- `main_route`
- `created_at`, `updated_at`, `deleted_at`

### project_routes
- `id` (uuid)
- `project_id` (FK projects.id)
- `name`
- `route`
- `created_at`, `updated_at`

### tasks
- `id` (uuid)
- `project_id` (FK projects.id)
- `title`
- `description?` (fonte de verdade do usuário)
- `notes?` (texto da IA)
- `ai_metadata?` (JSON com dados da IA)
- `priority_id` (FK priorities.id)
- `category_id` (FK categories.id)
- `status`: `pending | in_execution | executed`
- `acceptance_criteria` (JSON array de `{ id, text, done }`)
- `completed_at`
- `created_at`, `updated_at`, `deleted_at`

### subtasks
- `id` (uuid)
- `task_id` (FK tasks.id)
- `title`
- `description?`
- `status`: `pending | in_execution | executed`
- `completed_at`
- `created_at`, `updated_at`

### categories (seed default: feature, fix, test, doc)
- `id` (uuid)
- `name`
- `color` (hex, default `#000000`)
- `created_at`, `updated_at`

### priorities (seed default: Alta, Media, Baixa)
- `id` (uuid)
- `name`
- `color` (hex, default `#000000`)
- `created_at`, `updated_at`

## STATUS E CONCLUSÃO

- `status = executed` indica que a IA terminou a tarefa
- `completed_at` só é preenchido quando o usuário aprova
- O estado visual do progresso é derivado por função em `src/lib/` (não é coluna)

## CLI kw-cli

- CLI mora em `src/cli/` e **acessa o DB direto** (sem API)
- Binário: `kw-cli` (nome distinto da GUI `kowork` pra não colidir no PATH)
- Comandos: `create`, `done`, `task set/rm`, `project list/create/set`, `route add/rm`, `skill style/list`
- Após escritas no banco, avisa o servidor por HTTP (`notify.ts`) — best-effort
- Falhas retornam erro em pt-BR e exit code != 0

## REALTIME

- Atualizações de tasks publicam eventos via PubSub
- Front consome com `orpcWs` + TanStack Query

## QUALIDADE

- Manter lint/typecheck mínimos antes de subir mudanças
- Comandos principais: `bun dev`, `bun test`, `bun check`, `bun run oxlint`

## SUBDIRECTORY AGENTS

| Path | Propósito |
|---|---|
| `src/api/AGENTS.md` | Router ORPC, auth, schemas |
| `src/api/db/AGENTS.md` | Modelagem e queries |
| `src/routes/AGENTS.md` | Rotas, UI e organização de páginas |
| `src/components/AGENTS.md` | Componentes base |
| `src/cli/AGENTS.md` | CLI para AI Agents |
| `src-tauri/AGENTS.md` | Wrapper desktop Tauri |
| `docs/TERMINAL.md` | Sistema de terminais tmux integrado |

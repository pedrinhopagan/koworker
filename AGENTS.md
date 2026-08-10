# KOWORK KNOWLEDGE BASE

**Atualizado:** 2026-07-27 (seção de entidades derivada de `src/api/db/connection.ts`)

## VISÃO GERAL

Kowork v2: gestão de projetos e tarefas com apoio de AI Coding Agents. Stack Bun + ORPC + Kysely + SQLite no backend e React 19 + TanStack Router/Query + Tailwind + Radix no frontend.

## ESTRUTURA

```
src/
├── api/                 # ORPC (router.ts, routers/, schemas/), auth, config, db, helpers, pubsub
├── routes/              # TanStack Router (file-based)
├── components/          # Componentes de UI (shadcn + base)
├── constants/           # Conjuntos finitos de domínio (complexidade, categorias, release...)
├── hooks/
├── lib/
├── stores/              # Zustand
├── types/
├── cli/                 # CLI kw-cli (acesso direto ao DB)
scripts/                 # setup, seed, test runner, build/deploy do desktop
src-tauri/               # Wrapper desktop (janela, tray, backend sidecar). Sem plugin global-shortcut: o tray só anuncia o rótulo do atalho, que é registrado no WM
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
| **Constantes de domínio** | `src/constants/` | Complexidade, categorias default, templates de prompt |
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
- **Sombras**: o app roda no WebKitGTK com `WEBKIT_DISABLE_COMPOSITING_MODE=1` (`src-tauri/src/lib.rs`), então tudo que está visível é rasterizado no CPU a cada quadro e sombra com blur é o item mais caro da conta. `shadow-xs` e `shadow-sm` foram redefinidos em `src/index.css` para blur 0 e são os únicos degraus permitidos em superfície que rola (card, input, botão, turno de conversa). Blur (`shadow-md` pra cima) só em overlay flutuante — popover, dropdown, sheet, dialog, toast. Medido em `/terminals/$paneId` com 5.4k nós: p95 de 65ms por quadro com o `shadow-sm` borrado do Tailwind contra 14ms com o rente.
- **Selects**: SEMPRE `CustomSelect` (`@/components/ui/custom-select`). Nunca recriar o Select do shadcn nem usar `<select>` nativo. Motivo: as vars de tema (`--popover`, `--card`...) vivem em `.light`/`.dark` aplicados no `[data-theme-root]` (div interna em `__root.tsx`), não no `:root` — qualquer overlay Radix portado para o `document.body` fica fora do tema e renderiza transparente/preto. Todo primitivo com Portal (popover, dropdown, sheet, context-menu, custom-select) porta para `document.querySelector("[data-theme-root]")`; novos overlays devem fazer o mesmo.

## VALIDAÇÃO

- **Zod** é o padrão de schemas (API e UI)
- **Arktype** apenas onde for necessário pelo `@lobomfz/db` (schema de DB)

## ROUTER ORPC

- Router único em `src/api/router.ts`, agregando subrouters:
  - `router.projects.create` / `router.tasks.update` etc
- `wsRouter` separado em `src/api/router.ts` para streams

## BANCO DE DADOS

- **SQLite** tradicional via `@lobomfz/db` + Kysely
- **Fonte de verdade do schema**: `src/api/db/connection.ts`. Nada aqui vale contra esse arquivo; ao mexer em coluna, atualize os dois.
- **IDs**: `uuid` em `TEXT` gerado na aplicação. Exceções: `users.id` é `INTEGER AUTOINCREMENT`; `skill_settings` e `agent_settings` têm o `slug` como PK; `settings` tem `key` como PK.
- **snake_case** no DB, `camelCase` no TS
- **Datas**: todas as colunas `*_at` são epoch em ms (`number.integer`), nunca texto ISO
- **Booleanos**: não existem; são `INTEGER` 0/1 (`done`, `hide_terminal`, `quick_invoke`)
- **JSON**: colunas JSON são `TEXT` com `JSON.stringify/parse` (`tasks.file_order`, `task_storage_runs.manifest`, `agent_events.payload`)
- **Soft delete**: `projects`, `tasks`, `execution_runs` e `agent_sessions` possuem `deleted_at`
- **Conjuntos finitos**: só `user_type`, `task_storage_runs.status`, `prompt_history.kind`, `execution_runs.kind`, `execution_runs.status`, `agent_sessions.status` e `agent_events.kind` são enums no DSL. Complexidade, stage, tool e scope são texto livre no DB e o conjunto é garantido em `src/constants/` + boundary Zod.

## ENTIDADES

21 tabelas, na ordem de registro em `connection.ts`. `?` marca coluna opcional (nullable).

### users
- `id` (integer, autoincrement), `name`, `password`
- `user_type?`: `admin | user` (default `user`)

### projects
- `id` (uuid), `name`, `description?`
- `color` (hex, default `#000000`), `display_order` (default 0)
- `main_route` (caminho do projeto no disco)
- `hide_terminal` (0/1), `task_layout_version` (default 1)
- `created_at`, `updated_at?`, `deleted_at?`

### categories (seed default: feature, fix, doc, study)
- `id` (uuid), `name`, `color` (hex, default `#000000`)
- `structure_slug?` (slug em `constants/prompt-templates.ts`)
- `display_order` (default 0), `created_at`, `updated_at?`

### priorities
- `id` (uuid), `name`, `level` (default 1), `color` (hex, default `#000000`)
- `display_order` (default 0), `created_at`, `updated_at?`

### project_routes
- `id` (uuid), `project_id` (FK projects.id, cascade)
- `name`, `route`, `icon?`, `command?`
- `display_order` (default 0), `created_at`, `updated_at?`

### task_groups (as "features" da UI e da CLI)
- `id` (uuid), `project_id` (FK projects.id, cascade)
- `name`, `storage_key?`, `storage_slug?`
- `color` (hex, default `#000000`), `display_order` (default 0)
- `created_at`, `updated_at?`

### tasks
- `id` (uuid), `project_id` (FK projects.id, restrict)
- `folder_path`: pasta da task relativa a `projects.main_route`. O conteúdo canônico vive nos `.md` dessa pasta; a linha é só índice.
- `storage_key?`, `storage_slug?`: identidade congelada de storage
- `title?`: nullable. Sem título, o display cai no primeiro `.md` (`resolveDisplayTitle`)
- `priority_id?` (FK priorities.id, restrict), `category_id?` (FK categories.id, restrict): ambas opcionais
- `complexity` (default `medio`): conjunto em `constants/complexity.ts`
- `group_id?` (FK task_groups.id, set null): nulo = pseudo-grupo "Sem grupo"
- `display_order` (default 0): ordem manual dentro do bucket `group_id` + `category_id`
- `file_order?`: JSON array de nomes de `.md` para ordenar as abas
- `merge_ready_at?`, `worktree_branch?`, `merge_target_branch?`, `worktree_path?`, `worktree_pr_url?`: entrega em worktree
- `done` (0/1, default 0), `completed_at?`
- `created_at`, `updated_at?`, `deleted_at?`
- **Não existem** `description`, `notes`, `ai_metadata`, `status` nem `acceptance_criteria`. Esse conteúdo mora nos `.md` da pasta.

### task_storage_runs
- `id` (uuid), `project_id` (FK projects.id, restrict)
- `plan_hash`, `from_layout_version`, `to_layout_version`
- `status`: `planned | backed_up | applying_fs | committed_db | verified | completed | blocked | rollback_required | rolled_back`
- `manifest` (JSON), `backup_path?`, `lock_owner?`, `error?`
- `created_at`, `updated_at`, `completed_at?`

### skill_categories
- `id` (uuid), `name`, `color` (hex, default `#000000`)
- `display_order` (default 0), `created_at`, `updated_at?`

### skill_settings
- `slug` (PK, nome da pasta da skill no disco)
- `label?`, `icon?`, `color?`: overrides de apresentação; nada aqui toca o `SKILL.md`
- `category_id?` (FK skill_categories.id, set null)
- `quick_invoke` (0/1, default 0): filtra o picker do prompt bar
- `created_at`, `updated_at?`

### skill_source_paths
- `id` (uuid), `tool` (agent dono do caminho), `path`
- `scope` (default `custom`; `global` = root default semeado por plataforma)
- `created_at`

### agent_settings
- `slug` (PK, nome do arquivo `.md` do agent)
- `label?`, `icon?`, `color?`, `created_at`, `updated_at?`

### agent_source_paths
- `id` (uuid), `tool`, `path`, `scope` (default `custom`), `created_at`

### prompt_history
- `id` (uuid), `kind`: `copy | agent | skill`
- `text` (instrução crua) e `prompt` (texto final despachado)
- `target?`, `agent_slug?`, `skill_slug?`
- `project_id?`, `project_name?`: **sem FK**, o histórico sobrevive à exclusão do projeto
- `route_path?`, `model?`, `effort?`, `created_at`
- Deduplicado na entrada: reenviar prompt idêntico rebumpa `created_at` em vez de duplicar

### agent_sessions
- `id` (uuid): no claude é também o `--session-id`, então retomar é `--resume <id>` na mesma linha
- `user_id` (FK users.id, cascade), `project_id` (FK projects.id, restrict), `task_id?` (set null)
- `title`, `cli`, `cwd` (congelado no start; sessão retomada nunca troca de diretório)
- `cli_session_id?`: só o codex usa, é o `thread_id` que o `codex exec resume` exige
- `model?`, `effort?`, `agent?`, `permission_mode` (default `acceptEdits`; no codex guarda a política
  de aprovação e vale do próximo turno em diante)
- `status`: `live | ended | crashed`; `pid?`, `end_reason?`
- `started_at`, `updated_at`, `heartbeat_at?`, `ended_at?`, `deleted_at?`
- Índice único parcial: uma sessão `live` por tarefa

### agent_events
- `id` (uuid), `session_id` (FK agent_sessions.id, cascade), `run_id?` (FK execution_runs.id, set null)
- `seq`: ordem dentro da sessão, único por sessão e identidade no merge do front
- `kind`: `user | assistant | thinking | tool_use | tool_result | permission | question | notice | result`
- `payload`: JSON por `kind`; a fronteira que valida na leitura é `src/lib/agent-session.ts`
- `created_at`, `updated_at?`: bloco que muda de estado é atualizado, não duplicado

### execution_runs
- `id` (uuid), `user_id` (FK users.id, cascade), `project_id` (FK projects.id, restrict)
- `task_id?` (FK tasks.id, set null), `parent_run_id?` (FK execution_runs.id, set null)
- `session_id?` (FK agent_sessions.id, set null): o turno pertence a uma sessão viva
- `client_request_id?`, `request_fingerprint?`, `cli_session_id?`, `create_task_title?`
- `kind`: `prompt | flow`; `title`
- `status`: `running | done | failed | timeout | waiting_user | cancelled`
- `prompt?`, `original_prompt?`, `source?`, `interaction_mode?`, `input_kind?`
- `cli?`, `permission_mode?`, `model?`, `effort?`, `approval_mode?`, `stage?`, `agent?`
- `output?`, `error?`
- `started_at`, `updated_at`, `heartbeat_at?`, `finished_at?`, `deleted_at?`

### agent_session_snapshots
- `id` (uuid), `pane_id`, `workspace_label`, `tab_label`, `agent`, `cwd`
- `project_id?`, `project_name?`: **sem FK**, o retrato é histórico e sobrevive à exclusão do projeto
- `status`: status do radar no instante da captura; `working` é o que faz a restauração disparar `continue`
- `session_id?`, `session_path?`: a sessão do CLI, quando o agent a reportou ao daemon
- `title?`, `task_id?`, `task_title?`, `captured_at`, `restored_at?`
- Retrato único do que estava aberto no kw-terminal: reescrito inteiro a cada mudança do radar e nunca
  com a lista vazia, porque a queda do daemon (ou o desligamento da máquina) apagaria o retrato

### agent_session_snapshots
- `id` (uuid), `pane_id`, `workspace_label`, `tab_label`, `agent`, `cwd`
- `project_id?`, `project_name?`: **sem FK**, o retrato é histórico e sobrevive à exclusão do projeto
- `status`: status do radar no instante da captura; `working` é o que faz a restauração disparar `continue`
- `session_id?`, `session_path?`: a sessão do CLI, quando o agent a reportou ao daemon
- `title?`, `task_id?`, `task_title?`, `captured_at`, `restored_at?`
- Retrato único do que estava aberto no kw-terminal: reescrito inteiro a cada mudança do radar e nunca
  com a lista vazia, porque a queda do daemon (ou o desligamento da máquina) apagaria o retrato

### push_subscriptions
- `id` (uuid), `user_id` (FK users.id, cascade)
- `endpoint`, `p256dh`, `auth`, `expiration_time?`
- `created_at`, `updated_at`

### devices
- `id` (uuid), `user_id` (FK users.id, cascade), `name`, `user_agent?`
- `status`: `pending | approved | blocked`
- `first_ip?`, `last_ip?`, `created_at`, `last_seen_at`, `approved_at?`, `blocked_at?`
- Portão de acesso: sessão só vale amarrada a um device `approved` (o `deviceId` viaja no JWT).
  Requisição de loopback nasce aprovada; qualquer outra entra como `pending` e espera liberação.

### settings
- `key` (PK), `value` (string), `updated_at?`
- Chave-valor de SO: pasta base de projetos, template de emulador, multiplexador. O shape tipado e os defaults por plataforma vivem em `api/helpers/system-settings.ts`.

## STATUS E CONCLUSÃO

- `tasks` não tem coluna de status. Só `done` (0/1) e `completed_at`.
- Execução é rastreada em `execution_runs`, que é outra entidade: uma tarefa pode ter N runs (ou nenhum).
- Claude e Codex são sessão (`agent_sessions`) com N turnos, cada turno um `execution_runs`. No Claude
  o processo fica vivo entre turnos; no Codex cada turno é um `codex exec resume <thread>` e o id da
  thread mora em `agent_sessions.cli_session_id`. A execução de chamada única sobrou só na barra de
  prompt (`prompt.execute`). Detalhe em `docs/SESSOES.md`.
- A etapa do fluxo (`grill`, `plano`, `execucao`, `execucao-fases`, `revisao`) é **inferida dos artefatos da pasta** (`inferTaskStage`), nunca persistida na task. A ordem por complexidade vive em `COMPLEXITY_FLOWS` (`execucao-fases` só no fluxo `extremo`) e cada etapa tem agente próprio em `STAGE_AGENT`.
- O estado visual do progresso é derivado por função em `src/lib/` (não é coluna).

## STORAGE DE TAREFAS

- Projetos persistem `task_layout_version`; v1 e v2 continuam legíveis.
- Layout v1 aceita paths flat ou adotados sob `.koworker/`.
- Layout v2 usa `.koworker/tasks/<feature-slug>--<featureStorageKey>/<task-slug>--<taskStorageKey>/`.
- Tarefas sem feature usam `.koworker/tasks/_sem-feature/<task-slug>--<taskStorageKey>/`.
- `storage_key` e `storage_slug` são congelados; rename de tarefa ou feature não move arquivos.
- Apenas o coordinator de storage altera `folder_path`; movimentos preservam backup, staging e journal.
- `tasks`, `.backups`, `.staging` e `medias` são namespaces reservados.
- Reconciliação nunca roda no boot ou deploy.
- `withProjectStorageLock` serializa mutations em duas camadas: fila em memória por `projectId` no processo e arquivo de lock em `.koworker/.staging/locks/<projectId>.lock` criado com `open(path, "wx")`, que exclui outros processos (API e CLI).
- Um lock de mutation alheio é aguardado por até 10s; um lock de reconciliação falha na hora, e lock de PID morto é removido e reclamado (`purgeOrphanStorageLocks` limpa os órfãos).
- Dentro do lock a operação revalida `task_storage_runs` ativo do projeto e, quando recebe uma task, que `project_id` e `folder_path` não mudaram na espera.

## CLI kw-cli

- CLI mora em `src/cli/` e **acessa o DB direto** (sem API)
- Binário: `kw-cli` (nome distinto da GUI `kowork` pra não colidir no PATH)
- Comandos: `create`, `done`, `task` (create/list/show/set/done/reopen/rm/options/merge-ready/merge-completed/file), `feature` (list/create), `storage` (preview/reconcile), `project` (list/create/set), `route` (add/rm), `skill`, `backup`, `version`
- `kw-cli` sem argumento imprime o help completo, que é a lista canônica de comandos
- Após escritas no banco, avisa o servidor por HTTP (`notify.ts`), best-effort
- Toda mutation adquire o lock de storage do projeto
- Falhas retornam erro em pt-BR e exit code != 0

## REALTIME

- Canais do PubSub (`src/api/pubsub/index.ts`): `tasks`, `flow`, `promptRun`, `agentSession`,
  `agentRadar`, `agentRadarTranscript`, `notification`, `navigate` e `terminal`
- `wsRouter` expõe `auth.me`, `notifications`, `tasks`, `navigate`, `flow`, `promptRun`,
  `agentSession`, `agentRadar`, `agentRadarTranscript` e `terminal`
- `agentSession` entrega os blocos da conversa (por `seq`), o `busy` do agente e a mudança de
  `status` da sessão; a assinatura começa com o histórico inteiro para a reconexão não perder nada
- `agentRadarTranscript` é por `paneId` e entrega a conversa que o CLI aberto no kw-terminal grava em
  disco (`~/.claude/projects`, `~/.codex/sessions`), nos mesmos blocos de `agentSession`. Lote com
  `reset` é a conversa inteira de novo: o arquivo virou outro e os `seq` recomeçaram
- Origem do evento de task é marcada em `source`: `api`, `cli` ou `fs` (watcher de disco)
- `promptRun` carrega o desfecho (`done`, `failed`…), a cauda de saída (`output`) e os passos do agente
  já interpretados (`step`, com ferramenta, alvo e resultado)
- Front consome com `orpcWs` + TanStack Query

## QUALIDADE

- Manter lint/typecheck mínimos antes de subir mudanças
- Comandos: `bun dev`, `bun run typecheck`, `bun run oxlint`, `bun test`, `bun run check` (roda os três)
- `bun test` direto no arquivo funciona; o script `test` do package usa `scripts/test.ts`

## SUBDIRECTORY AGENTS

| Path | Propósito |
|---|---|
| `src/api/AGENTS.md` | Router ORPC, auth, schemas |
| `src/api/db/AGENTS.md` | Modelagem e queries |
| `src/routes/AGENTS.md` | Rotas, UI e organização de páginas |
| `src/routes/ROUTES_MAP.md` | Referência humana de navegação e layout |
| `src/components/AGENTS.md` | Componentes base |
| `src/cli/AGENTS.md` | CLI para AI Agents |
| `src-tauri/AGENTS.md` | Wrapper desktop Tauri |
| `docs/TERMINAL.md` | Sistema de terminais (tmux / kw-terminal / none + ORPC PubSub) |
| `docs/SESSOES.md` | Sessões de agente: processo vivo, protocolo do CLI, permissão e pergunta |

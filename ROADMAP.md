# KOWORK ROADMAP

**Status:** v2 em uso, paridade com o WorkOpilot v1 alcançada e ultrapassada
**Atualizado:** 2026-07-24 (cada linha conferida contra o código)

Este arquivo descreve o que existe e o que falta. Quando divergir do código, o código vence e este
arquivo é o errado. Schema e convenções ficam no `AGENTS.md` da raiz.

---

## O QUE JÁ EXISTE

### Infraestrutura

| Item | Estado | Onde |
|---|---|---|
| Tauri: janela, tray, sidecar do backend | Pronto | `src-tauri/src/{lib,tray,window,backend}.rs` |
| SQLite via `@lobomfz/db` + Kysely | Pronto | `src/api/db/connection.ts` |
| API ORPC, um router por domínio | Pronto | `src/api/router.ts`, `src/api/routers/` |
| WebSocket ORPC (`wsRouter`) | Pronto | `src/api/router.ts` + `src/api/pubsub/` |
| Build e deploy do desktop | Pronto | `scripts/desktop/` |
| PWA + push (web-push) | Pronto | `src/api/helpers/push-notifications.ts`, `push_subscriptions` |

### Backend

| Item | Estado | Onde |
|---|---|---|
| CRUD de projetos e rotas de projeto | Pronto | `routers/projects.ts`, `routers/project-routes.ts` |
| CRUD de tarefas (conteúdo em `.md` no disco) | Pronto | `routers/tasks.ts`, `helpers/task-*.ts` |
| Features (`task_groups`) | Pronto | `routers/task-groups.ts` |
| Categorias e prioridades | Pronto | `routers/categories.ts`, `routers/priorities.ts` |
| Storage v1/v2, plano, backup e reconciliação | Pronto | `routers/task-storage.ts`, `helpers/task-storage-coordinator.ts` |
| Execuções (`execution_runs`) | Pronto | `db/execution-runs.ts`, `routers/prompt.ts`, `routers/flow.ts` |
| Watcher de FS que sincroniza tarefas | Pronto | `helpers/tasks-watcher.ts`, `helpers/task-sync.ts` |
| Terminal (tmux / kw-terminal / none) | Pronto | `routers/terminal.ts`, `routers/kw-terminal.ts`, `docs/TERMINAL.md` |
| Skills e agents lidos do disco, com sync entre ferramentas | Pronto | `helpers/skills-fs.ts`, `helpers/skills-sync.ts`, `helpers/agents-fs.ts` |
| Vault, mídias e docs de projeto | Pronto | `routers/vault.ts`, `routers/media.ts`, `helpers/project-docs.ts` |
| Transcrição de áudio | Pronto | `helpers/audio-transcription.ts` |
| Configuração de SO chave-valor | Pronto | `helpers/system-settings.ts`, tabela `settings` |

### Frontend

| Item | Estado | Onde |
|---|---|---|
| Home com projeto em foco | Pronto | `routes/_app/index.tsx` |
| Projetos: lista, criação, detalhe, docs | Pronto | `routes/_app/projetos/` |
| Tarefas: lista, feature, detalhe e abas de arquivo | Pronto | `routes/_app/tarefas/` |
| Editor de documento com CodeMirror | Pronto | `components/doc-editor-pane.tsx` |
| Prompt bar global com undo de prompt | Pronto | `components/prompt-bar/` |
| Execuções: composer, histórico, continuação, resultado | Pronto | `routes/_app/executar/` |
| Skills e agents: lista e detalhe | Pronto | `routes/_app/skills/`, `routes/_app/agents/` |
| Vault e mídias | Pronto | `routes/_app/vault/`, `routes/_app/media/` |
| Configurações, fontes, sistema, kw-terminal | Pronto | `routes/_app/configuracoes.tsx` e irmãos |
| Mostruário de componentes | Pronto | `routes/_app/mostruario/` |

### CLI

`kw-cli` com `create`, `done`, `task` (create/list/show/set/done/reopen/rm/options/merge-ready/
merge-completed/file), `feature`, `storage`, `project`, `route`, `skill`, `backup` e `version`.
O help impresso por `kw-cli` sem argumento é a lista canônica.

---

## O QUE O v1 TINHA E O v2 NÃO TEM

- **Subtasks como entidade.** Foi abandonado de propósito. Não existe tabela `subtasks` nem router.
  Subtarefa hoje é um arquivo `.md` dentro da pasta da tarefa, ordenado por `tasks.file_order`.
- **Agenda / calendário.** Não existe rota nem router. Nunca foi implementado no v2.
- **Atalho global registrado pelo app.** O tray anuncia `Alt+K` (`Alt+L` em dev), mas não há plugin
  `global-shortcut`: a combinação é registrada fora do app, no gerenciador de janelas. Não há tela
  para configurar hotkey.
- **Integração com OpenCode via WebSocket.** O v2 não conversa com o OpenCode por socket. Ele
  apenas reconhece `.opencode/skills` como fonte de skills e despacha CLIs (`claude`, `codex`)
  por spawn.

---

## PENDÊNCIAS REAIS

Itens confirmados como ausentes ou incompletos hoje. Sem estimativa: entram quando forem prioridade.

### P1

- [ ] Achados abertos da auditoria de qualidade, com arquivo e linha em
      `.koworker/tasks/geral--5e959edc/auditoria-profunda-da-codebase--3d1e1ded/auditoria-completa.md`
      (o que já foi corrigido está em `correcoes-aplicadas.md`, na mesma pasta).

### P2

- [ ] Agenda / visualização por data, se ainda fizer sentido no produto.
- [ ] Configuração de atalho global dentro do app (hoje depende do WM).
- [ ] Métricas na home além do projeto em foco.

### P3

- [ ] Export/import de tarefas.
- [ ] Revisar a regra de comentários proibidos contra a base real (há comentário de decisão em
      arquivos centrais, incluindo `db/connection.ts`).

---

## DECISÕES DE ARQUITETURA

### Abandonado do v1

- Sidecar tRPC separado, DDD no core, múltiplos packages, lógica de negócio em Rust.
- Estado da tarefa em colunas (`status`, `description`, `notes`, `acceptance_criteria`).
  O conteúdo canônico é o `.md` no disco; o banco é índice.

### Mantido

- Tauri para janela, tray e empacotamento.
- SQLite local, TypeScript para toda lógica, React + TanStack Router/Query.
- Integração com terminal (tmux / kw-terminal).

### Novo no v2

- ORPC em vez de tRPC, Bun sem Node, Kysely + `@lobomfz/db`.
- Storage de tarefas versionado (`task_layout_version`) com plano, lock, backup e reconciliação.
- Execuções persistidas em `execution_runs`, com reconexão realtime e undo de prompt.
- Skills e agents lidos de múltiplos roots do disco e sincronizados entre ferramentas.

---

## NOTAS DE IMPLEMENTAÇÃO

### CLI escreve direto no DB

`kw-cli` não passa pela API. Depois de escrever, avisa o servidor por HTTP (`src/cli/notify.ts`),
best-effort. O servidor republica no PubSub com `source: "cli"` e o front revalida.

### Watcher de disco

Alterações feitas fora do app (o agente editando `.md`) chegam pelo watcher e publicam evento de
task com `source: "fs"` e sem `taskId`.

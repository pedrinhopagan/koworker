# TERMINAL AGENTS

## OBJETIVO

Gerenciar terminais integrados ao Kowork para execução de AI Coding Agents. Cada projeto tem sua própria sessão (workspace tmux/kw-terminal ou janela isolada no modo none), e cada tarefa pode ter sua própria tab/window.

## ARQUITETURA

```
Frontend (React)                    Backend (Bun + ORPC)
┌─────────────────┐                ┌──────────────────────┐
│ src/lib/        │                │ src/api/             │
│   terminal.ts   │ ── ORPC ────▶ │ routers/terminal.ts  │
└────────┬────────┘                │ helpers/terminal/    │
         │                          │   service.ts         │
         │                          │ tmux.ts | kw-terminal.ts │
         │                          └──────────┬───────────┘
         │                                     │
         │                                     ▼
         │                          ┌──────────────────────┐
         │                          │ Multiplexador        │
         │                          │ tmux | kw-terminal | none │
         │                          └──────────┬───────────┘
         │                                     │
         ▼                                     ▼
┌─────────────────┐                ┌──────────────────────┐
│ PubSub/WebSocket│ ◀── publish ── │ PubSub.terminal      │
│ (eventos)       │                │ (session/window)     │
└─────────────────┘                └──────────────────────┘
```

O frontend fala só com ORPC (`src/lib/terminal.ts`). O backend resolve template + multiplexador a partir das settings do sistema e delega para tmux, kw-terminal ou spawn direto de emulador.

## MULTIPLEXADORES

| Modo | Sessão do projeto | Window da tarefa | Attach / foco |
|------|-------------------|------------------|---------------|
| `tmux` | Sessão `kw_<slug>` | Window tmux | Emulador via `terminal_template` + `tmux attach` |
| `kw-terminal` | Workspace `--label sessionName` | Tab `--label windowName` | `kw-terminal workspace focus` + `kw-terminal tab focus`; spawna emulador com o cliente TUI se nenhum estiver aberto, depois foco WM |
| `none` | N/A (só tracking em memória) | Processo do emulador | Cada abertura spawna janela nova |

Configuração em `/sistema`: chave `terminal_multiplexer` (`tmux` | `none` | `kw-terminal`) e `terminal_template` (usado no spawn de emulador nos três modos: attach do tmux, cliente TUI do kw-terminal e janela do none).

## ESTRUTURA DE ARQUIVOS

```
src/lib/
├── terminal.ts              # API frontend (ORPC)
├── claude-command.ts        # Comando Claude
└── codex-command.ts         # Comando Codex

src/stores/
└── terminal-status.ts       # Zustand store (estado das sessões)

src/hooks/
└── use-terminal-events.ts   # Hook para eventos WebSocket

src/api/
├── pubsub/index.ts          # Canal PubSub para eventos
├── routers/terminal.ts      # Router ORPC (procedures + WS)
├── helpers/terminal/
│   ├── service.ts           # Orquestração (open/close/monitor)
│   ├── tmux.ts              # Adapter tmux
│   ├── kw-terminal.ts       # Adapter kw-terminal CLI
│   ├── names.ts             # Labels estáveis (session/window)
│   ├── focus.ts             # Foco WM (best-effort)
│   └── emulator.ts          # Spawn de emulador (tmux/none)
└── schemas/terminal.ts      # Schemas Zod de entrada

src/constants/terminal.ts    # Presets de emulador + multiplexadores
```

## API FRONTEND

### Funções principais

| Função | Descrição |
|--------|-----------|
| `openProjectTerminal(project)` | Abre/foca terminal do projeto |
| `openTaskTerminal(project, task)` | Abre tab para tarefa específica |
| `executeInTerminal(project, task, prompt, model?)` | Executa comando no terminal |
| `closeProjectTerminal(projectId)` | Fecha sessão inteira do projeto |
| `closeTaskTerminal(projectId, task)` | Fecha apenas a tab da tarefa |

### Uso

```typescript
import { openProjectTerminal, executeInTerminal } from "@/lib/terminal";

await openProjectTerminal({
  id: "uuid",
  name: "Meu Projeto",
  mainRoute: "/path",
});

await executeInTerminal(
  { id: "proj-uuid", name: "Projeto", mainRoute: "/path" },
  { id: "task-uuid", title: "Implementar feature" },
  "Implemente a feature X seguindo os critérios de aceite",
);
```

## ROUTER ORPC

Procedures em `src/api/routers/terminal.ts`:

| Procedure | Descrição |
|-----------|-----------|
| `openForTask` | Abre/cria sessão e window para tarefa |
| `openForRoute` | Abre tab para rota customizada do projeto |
| `closeProjectSession` | Fecha sessão inteira do projeto |
| `closeTaskWindow` | Fecha apenas a window da tarefa |
| `listInvocationSessions` | Lista projetos com tabs de agent/skill abertas |
| `closeInvocationSessions` | Fecha só invocações (`agent_*` / `skill_*`) |

WebSocket: `terminal.events` → `PubSub.terminal.subscribe`.

## NOMENCLATURA

Labels estáveis entre reinícios do backend (lookup por nome, não por ID volátil):

- **Sessão/workspace**: `kw_{primeira_palavra_do_projectName_lowercase}` (ex: `kw_kowork`)
- **Window/tab**: `{taskId[0:8]}_{sanitized_title}` (ex: `abcd1234_minha_tarefa`)
- **Invocações**: `agent_*` ou `skill_*` (filtro `isInvocationWindow`)

Implementação: `src/api/helpers/terminal/names.ts`.

## EVENTOS

```typescript
type TerminalEvent = {
  eventType: "session_opened" | "session_closed" | "window_opened" | "window_closed";
  projectId: string;
  taskId?: string;
  sessionName: string;
  windowName?: string;
};
```

Canal: `"terminal:global"`. O frontend consome via `orpcWs.terminal.events` e atualiza `terminal-status.ts`.

## STORE ZUSTAND

Maps por `projectId` / `taskId`; `handleEvent` reage aos quatro tipos de evento. Montado no layout em `src/routes/_app.tsx`.

## REGRAS

- Erros em pt-BR
- Foco de janela WM suporta Wayland (kdotool) e X11 (xdotool); no kw-terminal é best-effort após focus CLI, casando o título fixo "kw-terminal - Kowork"
- Sessões tmux/kw-terminal são monitoradas a cada 3s para detectar fechamento externo
- Modo kw-terminal auto-inicia o server headless (`kw-terminal server`) quando não está rodando e abre o cliente TUI (`kw-terminal session attach default`) num emulador quando nenhum está aberto, detectado por `pgrep`
- Sem migração automática entre multiplexadores; sessões antigas permanecem no modo original

## FLUXO DE EXECUÇÃO

1. Frontend chama `executeInTerminal` → ORPC `openForTask`
2. Backend lê `TerminalConfig` (template + multiplexador)
3. Cria ou reutiliza sessão/workspace e tab/window conforme labels
4. Envia comando ao pane (`kw-terminal pane run` / `tmux send-keys` / argv no emulador)
5. Se `background: false`, foca workspace/tab e garante um emulador atachado (tmux) ou um cliente TUI aberto (kw-terminal), depois foco WM
6. Publica eventos no PubSub
7. Frontend atualiza store via WebSocket

## DEPENDÊNCIAS

**Runtime:**

- `tmux` (modo tmux)
- `kw-terminal` com server rodando (modo kw-terminal)
- Emulador configurado no template (modo tmux/none/kw-terminal)
- `kdotool`/`xdotool` (foco WM, best-effort)

## ANTI-PATTERNS

| Proibido | Correto |
|----------|---------|
| Chamar tmux/kw-terminal direto do frontend | Usar funções de `terminal.ts` |
| Assumir ID volátil kw-terminal após restart | Lookup por label (`sessionName` / `windowName`) |
| Ignorar erros | Sempre tratar e mostrar toast |

# TERMINAL AGENTS

## OBJETIVO

Gerenciar terminais tmux integrados ao Kowork para execução de AI Coding Agents. Cada projeto tem sua própria sessão tmux, e cada tarefa pode ter sua própria tab/window.

## ARQUITETURA

```
Frontend (React)                    Backend (Tauri/Rust)
┌─────────────────┐                ┌──────────────────────┐
│ src/lib/        │                │ src-tauri/src/       │
│   terminal.ts   │ ──Tauri IPC──▶ │   terminal.rs        │
│   tauri.ts      │                │                      │
└────────┬────────┘                └──────────┬───────────┘
         │                                    │
         │                                    ▼
         │                         ┌──────────────────────┐
         │                         │ tmux + alacritty     │
         │                         │ (sessões por projeto)│
         │                         └──────────┬───────────┘
         │                                    │
         ▼                                    ▼
┌─────────────────┐                ┌──────────────────────┐
│ PubSub/WebSocket│ ◀── HTTP POST ─│ notify_backend()     │
│ (eventos)       │                │ (curl localhost)     │
└─────────────────┘                └──────────────────────┘
```

## ESTRUTURA DE ARQUIVOS

```
src/lib/
├── terminal.ts          # API principal (funções exportadas)
├── tauri.ts             # Wrappers para comandos Tauri

src/stores/
└── terminal-status.ts   # Zustand store (estado das sessões)

src/hooks/
└── use-terminal-events.ts  # Hook para eventos WebSocket

src/api/
├── pubsub/index.ts      # Canal PubSub para eventos
├── routers/terminal.ts  # Router ORPC (subscrição)
└── server.ts            # Endpoint HTTP /api/terminal/notify

src-tauri/src/
├── terminal.rs          # Comandos Rust (tmux)
└── lib.rs               # Registro dos comandos
```

## API FRONTEND

### Tipos

```typescript
type ProjectInfo = { id: string; name: string; mainRoute: string }
type TaskInfo = { id: string; title: string }
type TerminalResult = { success: boolean; message: string; result?: OpenTerminalResult }
```

### Funções Principais

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

// Abrir terminal do projeto
await openProjectTerminal({ id: "uuid", name: "Meu Projeto", mainRoute: "/path" });

// Executar prompt em tarefa
await executeInTerminal(
  { id: "proj-uuid", name: "Projeto", mainRoute: "/path" },
  { id: "task-uuid", title: "Implementar feature" },
  "Implemente a feature X seguindo os critérios de aceite"
);
```

## COMANDOS TAURI (RUST)

| Comando | Parâmetros | Descrição |
|---------|------------|-----------|
| `open_terminal_for_task` | projectId, projectName, mainRoute, taskId, taskTitle, model, prompt? | Abre/cria sessão e window |
| `close_project_session` | projectId | Fecha sessão tmux inteira |
| `close_task_window` | projectId, taskId, taskTitle | Fecha apenas a window |
| `get_active_sessions` | - | Lista sessões ativas |
| `check_session_exists` | projectId | Verifica se sessão existe |

## NOMENCLATURA TMUX

- **Sessão**: `kowork_{projectId[0:8]}` (ex: `kowork_a1b2c3d4`)
- **Window**: `{taskId[0:8]}_{sanitized_title}` (ex: `e5f6g7h8_implementar_feature`)
- **Título do terminal**: `{projectName} - Kowork` (ex: `Meu Projeto - Kowork`)

## EVENTOS

O Rust notifica o backend via HTTP POST para `/api/terminal/notify`:

```typescript
type TerminalEvent = {
  eventType: "session_opened" | "session_closed" | "window_opened" | "window_closed";
  projectId: string;
  taskId?: string;
  sessionName: string;
  windowName?: string;
}
```

O backend publica no PubSub, e o frontend consome via WebSocket.

## STORE ZUSTAND

```typescript
// terminal-status.ts
type TerminalStore = {
  activeSessions: Map<projectId, Set<taskId>>;
  isSessionActive(projectId: string): boolean;
  isTaskActive(projectId: string, taskId: string): boolean;
}
```

## REGRAS

- Comandos Tauri usam `camelCase` nos parâmetros (`#[tauri::command(rename_all = "camelCase")]`)
- Erros em pt-BR
- Foco de janela suporta Wayland (kdotool) e X11 (xdotool)
- Sessões são monitoradas em background para detectar fechamento externo
- No modo browser (sem Tauri), prompts são logados no console

## FLUXO DE EXECUÇÃO

1. Frontend chama `executeInTerminal(project, task, prompt)`
2. `terminal.ts` verifica se está no Tauri
3. Chama comando Tauri `open_terminal_for_task`
4. Rust cria sessão tmux se não existir
5. Rust cria window para tarefa se não existir
6. Rust abre alacritty se necessário
7. Rust foca na janela do terminal
8. Rust envia comando `opencode run --model X --prompt "Y"`
9. Rust notifica backend via HTTP
10. Backend publica evento no PubSub
11. Frontend atualiza store via WebSocket

## DEPENDÊNCIAS

**Frontend:**
- `@tauri-apps/api` (invoke)
- `sonner` (toasts)
- `zustand` (store)

**Backend (Rust):**
- `serde` / `serde_json`
- `tauri`
- Comandos externos: `tmux`, `alacritty`, `kdotool`/`xdotool`, `curl`

## ANTI-PATTERNS

| Proibido | Correto |
|----------|---------|
| Chamar Tauri diretamente | Usar funções de `terminal.ts` |
| `git add .` no prompt | Prompts específicos e seguros |
| Hardcoded model | Usar constante `DEFAULT_MODEL` |
| Ignorar erros | Sempre tratar e mostrar toast |

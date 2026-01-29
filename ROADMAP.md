# KOWORK ROADMAP

**Status:** v2 em desenvolvimento
**Objetivo:** Atingir paridade funcional com WorkOpilot v1, com arquitetura simplificada

---

## Comparativo v1 → v2

### O que v1 tinha e v2 precisa

| Funcionalidade | v1 (WorkOpilot) | v2 (Kowork) | Status |
|---------------|-----------------|-------------|--------|
| **Infraestrutura** ||||
| Tauri + shortcut global | ✅ Completo | ✅ Implementado | ✅ Done |
| System tray | ✅ Completo | ✅ Implementado | ✅ Done |
| SQLite local | ✅ via Rust | ✅ via Bun + Kysely | ✅ Done |
| ORPC/tRPC API | ✅ tRPC + sidecar | ✅ ORPC direto | ✅ Done |
| WebSocket real-time | ✅ via IPC | ✅ ORPC WS | ✅ Done |
| **Backend** ||||
| CRUD Projects | ✅ Completo | ✅ Routers prontos | ✅ Done |
| CRUD Tasks | ✅ Completo | ✅ Routers prontos | ✅ Done |
| CRUD Subtasks | ✅ Completo | ✅ Routers prontos | ✅ Done |
| Categories/Priorities | ✅ Completo | ✅ Routers prontos | ✅ Done |
| Task Executions | ✅ Tracking completo | ❌ Não implementado | 🔴 P1 |
| Terminal linking (tmux) | ✅ Completo | ⚠️ Estrutura existe | 🟡 P2 |
| **Frontend** ||||
| Home dashboard | ✅ Com métricas | ⚠️ Skeleton | 🟡 P2 |
| Lista de projetos | ✅ Cards + CRUD | ⚠️ Skeleton | 🟡 P2 |
| Lista de tarefas | ✅ Filtros, status | ⚠️ Skeleton | 🔴 P1 |
| Detalhe de tarefa | ✅ Completo | ❌ Não existe | 🔴 P1 |
| Subtasks com drag | ✅ Reordenação | ❌ Não existe | 🔴 P1 |
| Agenda/Calendar | ✅ Básico | ⚠️ Skeleton | 🟢 P3 |
| Settings | ✅ Hotkey config | ❌ Não existe | 🟢 P3 |
| **Integração AI** ||||
| OpenCode connection | ✅ WebSocket API | ❌ Não implementado | 🔴 P1 |
| Action System | ✅ 6 actions | ❌ Não implementado | 🔴 P1 |
| Skills (7 total) | ✅ Completo | ❌ Não existe | 🔴 P1 |
| Quickfix | ✅ Prompt inline | ❌ Não existe | 🟡 P2 |
| **CLI** ||||
| CLI completa | ✅ 15+ comandos | ⚠️ Estrutura vazia | 🟡 P2 |

---

## Fases de Implementação

### Fase 1: Core Task Management (P1) 🔴
**Objetivo:** Ter um app funcional para gerenciar tarefas

#### 1.1 Página de Lista de Tarefas
- [ ] Componente TaskList com dados reais
- [ ] Filtros funcionais (projeto, status, prioridade, categoria)
- [ ] TaskItem com status visual
- [ ] Criar tarefa inline
- [ ] Busca por texto

#### 1.2 Página de Detalhe de Tarefa
- [ ] Rota `/tarefas/$taskId`
- [ ] Header: título editável, categoria, prioridade
- [ ] Seção descrição (rich text ou markdown)
- [ ] Seção notas técnicas
- [ ] Status com transições visuais

#### 1.3 Sistema de Subtasks
- [ ] Lista de subtasks com checkbox
- [ ] Criar subtask inline
- [ ] Editar título/descrição
- [ ] Reordenar com drag-and-drop
- [ ] Status individual (pending → in_execution → executed)

#### 1.4 Backend: Executions
- [ ] Tabela `task_executions` no schema
- [ ] Router ORPC para executions
- [ ] Start/end execution
- [ ] Heartbeat tracking

---

### Fase 2: Integração OpenCode (P1) 🔴
**Objetivo:** Conectar com coding agents

#### 2.1 OpenCode Service
- [ ] Conexão WebSocket com OpenCode API
- [ ] Listeners: session.idle, file.change
- [ ] Estado de conexão no UI

#### 2.2 Sistema de Actions
- [ ] Action Registry (structure, execute, review, commit)
- [ ] Componente ActionButtons
- [ ] Geração de prompts por action
- [ ] Estado: suggested action baseado em progress

#### 2.3 Terminal Integration
- [ ] Tabela `task_terminals`
- [ ] Link tmux session à task
- [ ] Focus terminal action
- [ ] Criar window tmux com nome da task

#### 2.4 Skills
- [ ] Copiar/adaptar skills do v1
- [ ] `kowork-structure`
- [ ] `kowork-execute-all`
- [ ] `kowork-execute-subtask`
- [ ] `kowork-review`
- [ ] `kowork-commit`
- [ ] Sync skills para ~/.config/opencode/skills/

---

### Fase 3: UI Completa (P2) 🟡
**Objetivo:** Interface polida e funcional

#### 3.1 Projetos
- [ ] Lista de projetos com cards
- [ ] CRUD projeto (criar, editar, arquivar)
- [ ] Cores customizáveis
- [ ] Rotas do projeto
- [ ] Contagem de tarefas por status

#### 3.2 Home Dashboard
- [ ] Métricas: tarefas pendentes, em execução, revisão
- [ ] Tarefas recentes
- [ ] Próximas tarefas agendadas
- [ ] Atalhos para ações frequentes

#### 3.3 Componentes Reutilizáveis
- [ ] CategorySelect
- [ ] PrioritySelect
- [ ] ProjectSelect
- [ ] StatusSelect
- [ ] TaskItem (compacto e expandido)
- [ ] SubtaskItem

#### 3.4 CLI Kowork
- [ ] `kowork list-tasks`
- [ ] `kowork get-task <id>`
- [ ] `kowork update-task <id> --status`
- [ ] `kowork create-subtask <taskId>`
- [ ] `kowork start-execution <taskId>`
- [ ] `kowork end-execution <taskId>`

---

### Fase 4: Polish & Extras (P3) 🟢
**Objetivo:** Funcionalidades secundárias

#### 4.1 Agenda
- [ ] Visualização calendário
- [ ] Tarefas agendadas
- [ ] Drag para reagendar

#### 4.2 Settings
- [ ] Configurar hotkey global
- [ ] Tema (dark/light/system)
- [ ] Configuração de terminal preset

#### 4.3 Quickfix
- [ ] Input inline para ajustes rápidos
- [ ] Skill `kowork-quickfix`
- [ ] Feedback visual durante execução

#### 4.4 Extras
- [ ] Business rules na task
- [ ] Acceptance criteria
- [ ] Imagens/screenshots na task
- [ ] Export/import de tasks

---

## Arquitetura Simplificada (v2 vs v1)

### Removido/Simplificado
- ❌ Sidecar process (tRPC server separado)
- ❌ DDD no core package
- ❌ Múltiplos packages (core/sdk/cli/sidecar)
- ❌ Rust para lógica de negócio

### Mantido/Adaptado
- ✅ Tauri para shortcut + window + tray
- ✅ SQLite para persistência
- ✅ TypeScript para toda lógica
- ✅ React + TanStack Router/Query
- ✅ Integração tmux/OpenCode

### Novo
- ✅ ORPC em vez de tRPC (mais simples)
- ✅ Bun nativo (sem Node)
- ✅ Kysely + @lobomfz/db (schema tipado)
- ✅ Estrutura flat (tudo em src/)

---

## Definição de Pronto

### MVP (Fases 1-2)
- [ ] Criar/editar/deletar tasks
- [ ] Subtasks com reordenação
- [ ] Conectar com OpenCode
- [ ] Executar actions (structure, execute, review, commit)
- [ ] Ver status de execução

### v1 Parity (Fases 1-4)
- [ ] Todas funcionalidades do WorkOpilot v1
- [ ] CLI funcional
- [ ] Skills completas
- [ ] UI polida

---

## Notas de Implementação

### CLI → DB Direto
A CLI do kowork acessa o DB diretamente (sem API). Para manter o front atualizado:
- Opção 1: CLI dispara evento via socket local
- Opção 2: Front faz polling periódico
- Opção 3: Tauri event system

### PubSub
Mudanças feitas via API já disparam PubSub. O front consome via `orpcWs`.

### OpenCode Plugin
Criar plugin similar ao workopilot.js que notifica o Clawdbot quando sessão fica idle.

---

## Próximos Passos Imediatos

1. **Implementar TaskList** - componente com dados reais
2. **Criar rota /tarefas/$taskId** - página de detalhe
3. **SubtaskList com drag** - reordenação funcional
4. **Conectar OpenCode** - service básico
5. **Action buttons** - structure/execute/review/commit

---

*Última atualização: 2026-01-29*

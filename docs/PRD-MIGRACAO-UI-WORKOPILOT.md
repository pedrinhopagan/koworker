# PRD — Migração de UI do Workopilot para Kowork

Data: 2026-01-30  
Origem visual: `workopilot-front-end` (copiado na raiz do repo)  
Destino: `src/` do Kowork v2

---

## Objetivo

Replicar o visual e a experiência do Workopilot no Kowork v2 com alta fidelidade, mantendo a estrutura de componentes mais limpa e sustentável. A migração deve ser gradual, com melhorias de arquitetura de UI (menos props, componentes mais inteligentes e com variantes).

## Não objetivos

- Reescrever regras de negócio do backend.
- Reproduzir dependências do Workopilot que não fazem sentido no Kowork (ex.: tRPC, serviços Tauri específicos).
- Migrar tudo de uma vez.

## Princípios

- Visual praticamente igual ao Workopilot.
- Estrutura de componentes melhorada (props mínimas, variantes claras).
- Português em strings e nomes.
- Usar `Title` e `Text`.
- Ícones apenas de `lucide-react`.
- `tailwind-variants` para variantes.

---

## Diagnóstico do Workopilot (inventário visual)

### Tema e tokens

- Tema escuro como padrão.
- `radius = 0` (arestas retas).
- Fonte mono (`JetBrains Mono`), `font-size: 13px`, `line-height: 1.4`.
- Paleta principal: fundo #1c1c1c, card #232323, bordas #3d3a34, primária #909d63, acento #ebc17a, erro #bc5653.
- Uso extensivo de CSS variables e `@theme inline` para tokens do Tailwind.
- Animações utilitárias (fade, slide, scale, shimmer, glow, etc.).

### Layout global

- **TabBar** no topo com tabs principais (Home, Projetos, Tarefas, Agenda) + Settings + botão esconder.
- **Barra de foco de projeto** logo abaixo, com `CustomSelect` e cor de destaque do projeto.
- Layout principal com sidebar opcional + área principal (PageGridLayout).

### Componentes UI (base)

Lista relevante para migrar:

- Badge, Button, Card, Checkbox, Chip
- CustomSelect
- ContextMenu
- Pagination
- Popover
- ProgressCircle
- EmptyFeedback
- Sonner (toast)
- SortableList
- Switch, Input, Textarea

### Componentes de domínio (tasks)

- **TaskItem** (principal item visual)
- TaskList
- SubtaskItem, SubtaskList
- CategorySelect + drawer
- UrgencySelect + drawer
- TaskStatusSelect
- InlineTaskCreate

### Componentes de domínio (projects)

- ProjectCard + skeleton
- ProjectSelect

### Componentes de domínio (agenda)

- DayTaskItem
- DayDrawer

### Páginas principais (estrutura)

#### Home

- Coluna esquerda com cartões:
  - Tarefa em foco (com progress circle e botão executar subtask).
  - Tarefas do dia.
  - Atalhos rápidos.
- Área principal:
  - Resumo do dashboard.
  - Lista “Tarefas em andamento” (TaskItem compact).
  - Mini calendário semanal com badges.

#### Tarefas

- Layout dividido.
- Lista com TaskItem (full) + paginação.
- Painel lateral/detalhe de tarefa.
- Ações de fluxo (structure → execute → review → commit).

#### Projetos

- Lista de projetos + painéis de preview.
- Sidebar de projetos com contadores e filtros.

#### Agenda

- Lista por dia e drawer com tarefas não agendadas.
- Drag and drop e estado visual para tasks agendadas.

#### Settings

- Preferências básicas, atalhos, integração.

---

## Mapeamento Workopilot → Kowork

### Infraestrutura

- Workopilot usa tRPC + stores locais; Kowork usa ORPC + TanStack Query.
- Workopilot tem CSS global em `app.css`; Kowork precisa incorporar tokens no `src/app.css` atual.

### Tipos

- Workopilot tem `Task`, `TaskFull`, `TaskExecution`, `Subtask` etc.
- Kowork possui `tasks` com `status: pending | in_execution | executed` e `acceptance_criteria`.
- Componentes devem aceitar o `Task` do Kowork e buscar dados extras via hooks quando necessário, evitando prop drilling.

### Layout

- TabBar e Project Focus devem virar componentes em `src/routes/_app/-components/`.
- PageGridLayout deve ser migrado para `src/components/layouts/`.

---

## Plano de migração gradual (fases)

### Fase 0 — Fundação visual

Objetivo: deixar o Kowork com os mesmos tokens base do Workopilot.

- Migrar CSS variables e tokens do `workopilot-front-end/app.css`.
- Replicar fontes e tipografia base.
- Garantir Tailwind tokens para background, card, border, etc.
- Adicionar utilitários de animação necessários.

### Fase 1 — UI base (shadcn + custom)

Objetivo: disponibilizar os mesmos primitivos para os componentes de domínio.

- Badge, Chip, Button, Card, Checkbox, Input, Textarea, Switch.
- ContextMenu, CustomSelect, Pagination, ProgressCircle.
- Padronizar variantes com `tailwind-variants`.

### Fase 2 — Layout e navegação

Objetivo: reproduzir o shell do app.

- TabBar (com tabs, settings, hide).
- Barra de foco de projeto.
- MainLayout e PageGridLayout.
- AppShell do Kowork ajustado para novo visual.

### Fase 3 — Domínio: tasks (prioridade máxima)

Objetivo: entregar a UI mais crítica.

- TaskItem (props mínimas).
- TaskList e variações compact/default.
- SubtaskItem + SubtaskList.
- TaskStatusSelect, CategorySelect, UrgencySelect.
- Ações do fluxo (structure/execute/review/commit) na UI.

### Fase 4 — Domínio: projetos e agenda

Objetivo: consolidar o look and feel do app.

- ProjectCard + ProjectSidebar + preview panel.
- Agenda semanal + DayDrawer.

### Fase 5 — Home e polish

Objetivo: fidelidade visual total.

- Dashboard da Home.
- Cards de resumo, progress circle e atalhos.
- Micro-interações e animações.

---

## Diretrizes de arquitetura de componentes

- Props mínimas, com dados essenciais (`task` + `variant`).
- Dados complementares devem ser buscados via hooks no próprio componente.
- `variant` com `tailwind-variants` e nomes simples (`compact`, `default`).
- Evitar componentes > 200 linhas (quebrar em subcomponentes).

---

## Primeiro passo (já aplicado)

- **TaskItem migrado** com props reduzidas para `task` + `variant`.
- Novo `Badge` base em `src/components/ui/`.

Arquivos:

- `src/components/tasks/TaskItem.tsx`
- `src/components/ui/badge.tsx`
- `src/routes/_app/tarefas/-components/task-list.tsx`
- `src/types/tasks.ts`

---

## Próximos passos sugeridos (após validação)

1. Migrar tokens e CSS do `workopilot-front-end/app.css`.
2. Criar `PageGridLayout` e `TabBar` no Kowork.
3. Migrar `TaskList`, `SubtaskItem` e `SubtaskList`.
4. Refatorar páginas de Tarefas para layout e estilos do Workopilot.

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
| `focusAgent` | Foca a sessão do CLI ativo (claude/codex) aberta **dentro do projeto em foco**; sem sessão lá, abre a tab `cli_<cli>` no grupo do projeto e sobe o CLI nela. Exige projeto: um agent aberto em outra pasta nunca é focado, porque levaria o kw-terminal para um grupo que não é o da tela |
| `openForTask` | Abre/cria sessão e window para tarefa |
| `openForRoute` | Abre tab para rota customizada do projeto |
| `closeProjectSession` | Fecha sessão inteira do projeto |
| `closeTaskWindow` | Fecha apenas a window da tarefa |
| `listInvocationSessions` | Lista projetos com tabs de agent/skill abertas |
| `closeInvocationSessions` | Fecha só invocações (`agent_*` / `skill_*`) |

WebSocket: `terminal.events` → `PubSub.terminal.subscribe`.

Procedures em `src/api/routers/kw-terminal.ts`, que é o que a rota `/terminals` consome:

| Procedure | Descrição |
|-----------|-----------|
| `overview` | Workspaces com suas tabs, do daemon |
| `sessionStart` | Cria uma tab e sobe Claude/Codex com prompt, agent, modelo, esforço e modo seguro; devolve o `paneId` |
| `sessionResumeLast` | Cria uma tab e executa `claude --continue` ou `codex resume --last` após ação explícita |
| `tabCreate` / `tabFocus` / `tabRename` / `tabClose` | Ações de tab |
| `workspaceFocus` / `workspaceRename` / `workspaceClose` | Ações de workspace |

Procedures em `src/api/routers/agent-history.ts`, que é o que a rota `/terminals/history` consome:

| Procedure | Descrição |
|-----------|-----------|
| `list` | Conversas antigas de Claude e Codex lidas do disco, filtradas por projeto, CLI e busca |
| `get` | Uma conversa antiga inteira, já traduzida em blocos |
| `resume` | Sobe a CLI de novo naquela conversa (ou devolve o pane vivo, se já houver um) |
| `openDiff` | Abre o kw-diff na pasta onde a sessão rodou |

## NOMENCLATURA

Labels estáveis entre reinícios do backend (lookup por nome, não por ID volátil):

- **Sessão/workspace**: `kw_{projectName_completo_em_slug}` (ex: `Dogama Vault` vira `kw_dogama-vault`)
- **Sem projeto**: `kw_sem-projeto` (`NO_PROJECT_SESSION_NAME`), o grupo de quem roda numa pasta que
  nenhum projeto cadastrado cobre — uma conversa antiga retomada de `~`, por exemplo
- **Window/tab de tarefa ou de job**: `{id[0:8]}_{sanitized_title}` (ex: `abcd1234_minha_tarefa`)
- **Rota do projeto**: nome da rota sanitizado (`sanitizeRouteName`)
- **Tab do CLI do projeto**: `cli_claude` / `cli_codex`
- **Invocações**: `agent_{slug}` ou `skill_{slug}` (filtro `isInvocationWindow`)
- **Sessão livre da rota `/terminals`**: `sess_{nome}` ou `sess_{hhmm}` (`sessionTabName`)

Implementação: `src/api/helpers/terminal/names.ts`. **Ninguém monta esses nomes à mão.** Quem abre
terminal descreve o alvo (`TerminalTabTarget`: `task`, `run`, `route`, `cli`, `invocation`,
`session`) e `terminalTabLabel` devolve o rótulo — é o que garante que a mesma tarefa, rota ou CLI
caia sempre na mesma tab, seja qual for a tela que disparou a ação.

O grupo sai do **nome do projeto no banco**, nunca da pasta onde o comando calhou de rodar: um
`basename(cwd)` faria uma conversa de `~` criar o grupo `kw_pedro`. `projectWorkspace`
(`terminal/service.ts`) e `ensureWorkspaceByLabel` (`terminal/kw-terminal.ts`) são os únicos caminhos
para obter um workspace; jobs (`kw_execucoes`) e a reabertura do retrato passam pelo mesmo `ensure`.

## ROTA /terminals

`/terminals` mostra apenas agents abertos no daemon. Cada linha abre `/terminals/$paneId`; foco no
cliente TUI, diff e fechamento são ações secundárias.

No desktop, o detalhe mantém a lista à esquerda e a conversa à direita. No mobile, lista e detalhe
são páginas separadas. O `paneId` é a identidade pública enquanto o pane existe; fechar o pane
encerra envio, assinatura e validade da rota.

A timeline prioriza `agent_session_path` informado pelo CLI ao daemon. Quando uma integração antiga
não reporta o caminho, o backend usa `pane process-info`. No Codex, aceita somente o rollout raiz
aberto pelos PIDs daquele pane e exclui subagentes pelo `session_meta`. No Claude, lê o registro
`~/.claude/sessions/<pid>.json` do processo e procura o JSONL com aquele UUID exato. Não há escolha
por `cwd`, data de modificação ou sessão recente do diretório.

O OpenCode não grava arquivo por sessão: todas ficam no banco SQLite
`~/.local/share/opencode/opencode.db`. A integração do kw-terminal reporta o id (`ses_...`) e o
radar lê a conversa direto do banco, uma consulta por segundo enquanto alguém está com o pane na
tela; bloco só vira fala quando o passo terminou, para texto pela metade nunca congelar na tela.
Instância aberta antes da integração existir (o plugin carrega na partida) não reporta nada: o
sincronizador instala a integração na primeira vez que vê isso e adota do banco a sessão mais
recente daquele diretório, ignorando subagentes (`parent_id`) e arquivadas. Duas instâncias vivas no
mesmo diretório sem reporte caem na mesma adotada — é o limite do sinal disponível. Esse recorte não
aparece em `/terminals/history`, que continua listando só o que claude e codex gravam em disco.

`sessionStart` e `sessionResumeLast` instalam a integração oficial do Claude ou Codex antes de subir
o processo. Isso mantém o reporte nativo nas sessões seguintes; a resolução por processo cobre panes
que já estavam abertos ou integrações que reportam apenas o ID.

Ao abrir a conversa, o backend percorre o transcript inteiro em blocos e mantém todos os eventos
traduzidos da sessão. Mensagens digitadas diretamente no CLI entram na mesma timeline; compactações
aparecem como marcos próprios, sem substituir o histórico anterior nem atribuir o resumo automático
ao usuário.

A barra no campo de escrita abre um menu só, com skills e comandos da CLI do pane misturados e
buscáveis juntos (`src/lib/slash-menu.ts` sobre `src/constants/cli-commands.ts`). Comando aparece
apenas quando a barra é o primeiro caractere do input, porque é assim que a própria CLI o lê; no meio
de uma frase só sobram as skills. `Tab` e clique completam e devolvem o cursor; `Enter` completa e
despacha quando a barra está na primeira coluna, e uma linha única começando com `/` também vai com
`Enter` seco. Comando é texto comum no `agentRadar.send`: quem o interpreta é a CLI do outro lado.

Texto enviado pelo app usa `agent send` seguido de `Enter`, mas só aparece quando o transcript nativo
o devolver. `working` bloqueia envio e oferece interrupção explícita por `C-c`. Em `blocked`, o campo
continua aceitando respostas e o controle do prompt envia somente as teclas de navegação, confirmação
e cancelamento admitidas pelo schema; permissões e perguntas nativas podem ser respondidas pelo PWA
mesmo quando o transcript não contém o texto do seletor da CLI.

A pergunta estruturada do claude (`AskUserQuestion`) vira bloco `question` na conversa, com as opções
completas, porque o `tool_use` dela já está no transcript antes da resposta; a resposta chega pelo
`tool_result` do mesmo id e fecha o bloco com o que foi escolhido. Com o pane em `blocked`, clicar
numa opção de escolha única dirige o seletor do CLI às cegas (N `Down` + `Enter`, cursor na primeira
opção); seleção múltipla e texto livre ficam nos controles manuais. O menu de permissão nunca é
gravado no arquivo, então ele não tem bloco — por isso sessões nascidas do PWA sobem em bypass por
padrão (`--dangerously-skip-permissions` no claude, `--dangerously-bypass-approvals-and-sandbox` no
codex), com os modos restritivos ainda disponíveis nas opções avançadas.

O modelo em uso na sessão sai do próprio transcript (`message.model` das linhas `assistant` no
claude, `turn_context.payload.model` no codex) e viaja no envelope de `agentRadarTranscript` e no
`transcriptPreviews`: a faixa do pane e o cartão da lista mostram o modelo real, não o que o spawn
pediu — um `/model` no meio da conversa aparece na próxima resposta.

O `done` do daemon entra no radar como `blocked` (`normalizeAgentRadarStatus`): agent que devolveu a vez
cobra a mesma coisa que agent travado, então o koworker tem um estado só de "esperando você". Isso vale
para o placar, o chip do cartão, a notificação e o item Terminais da sidebar, que mostra a cobrinha
quando tem agent trabalhando e o carimbo em laranja quando tem agent esperando.

O indicador "Na tela" (workspace/tab/agent) espelha o foco do cliente TUI ao vivo: o watcher do radar
assina `workspace.focused` / `tab.focused` / `pane.focused` no daemon e publica o trio no canal
`agentRadar` junto com o mapa de agents. Trocar de workspace ou tab no kw-terminal atualiza o koworker
sem ação no app e sem releitura do `kwTerminal.overview`.

## REABERTURA DE TERMINAIS

Enquanto há agents abertos, o radar grava um retrato de `workspaceLabel`, `tabLabel` e `cwd`. A queda
do daemon e o encerramento do backend preservam esse retrato; fechar panes normalmente atualiza ou
limpa a lista, para não reaparecer no próximo boot.

Quando o radar volta vazio e existe um retrato pendente de uma execução anterior, `/terminals` mostra
"Reabrir terminais". A ação recria workspaces e tabs idempotentemente, confirma cada criação pela
leitura do daemon e abre o cliente TUI. Os panes ficam no shell do diretório original: nenhum CLI é
iniciado, nenhuma conversa é retomada e nenhum comando ou prompt é enviado.

O retrato vive em `agent_session_snapshots`. Uma captura nova substitui a anterior; tabs restauradas
são marcadas para o botão desaparecer até haver uma nova captura de agents vivos.

## HISTÓRICO DE CONVERSAS

`/terminals/history` mostra o que Claude e Codex já gravaram em disco, não o que está aberto no
daemon: `~/.claude/projects/<cwd-slug>/<sessionId>.jsonl` e `~/.codex/sessions/<ano>/<mês>/<dia>/
rollout-*.jsonl`. As duas CLIs entram na mesma lista, em ordem de última escrita, com filtro de
projeto, de CLI e busca por assunto, pasta ou branch. Sem projeto escolhido no search a lista segue o
projeto em destaque do app; `?projectId=todos` é a escolha explícita de ver tudo.

O recorte vive na URL (`projectId`, `cli`, `q`) porque a lista e a conversa aberta são a mesma tela
em dois passos: `/terminals/history/$cli/$sessionId` mantém o histórico à esquerda no desktop e
carrega o mesmo recorte, então trocar de sessão não perde o filtro que levou até ela.

Filtrar por projeto não abre arquivo: a pasta do claude é o `cwd` com todo caractere fora de
`[a-zA-Z0-9]` virando `-`, e o prefixo já descarta as outras raízes (a raiz entra pelo caminho
cadastrado e pelo real, porque o projeto pode estar registrado por link simbólico). No codex não há
essa pista, então o `cwd` sai do `session_meta` da primeira linha, que também é o que exclui rollout
de subagente. Cabeçalho lido é guardado por caminho — o começo de um transcript nunca é reescrito.

A conversa vira blocos pelos mesmos tradutores da conversa ao vivo (`claude-transcript.ts`,
`codex-transcript.ts`) e é lida por inteiro a cada abertura, sem assinatura e sem composer: histórico
é registro, não canal.

O vínculo com tarefas vem de três lugares, nesta ordem: o registro do koworker (`agent_sessions`,
`execution_runs`, `agent_session_snapshots` casados pelo id da sessão do CLI), o worktree onde a
sessão rodou (`tasks.worktree_path` contendo o `cwd`) e a pasta da tarefa citada na conversa. A
menção só conta a partir da segunda ocorrência: caminho que aparece uma vez só é quase sempre
respingo de uma listagem, enquanto a tarefa trabalhada é lida e escrita dezenas de vezes. Por isso a
varredura é do arquivo inteiro, e só das conversas que vão aparecer na página.

Retomar (`agentHistory.resume`) cria uma tab no workspace do projeto que cobre a pasta da sessão —
ou no grupo `kw_sem-projeto`, quando nenhum a cobre —, na pasta onde a sessão rodou,
rodando `claude --resume <id>` ou `codex resume <id>`, e leva para `/terminals/$paneId`. Se aquela
mesma sessão já está viva num pane (o radar conhece o `sessionId`), nada sobe: o botão vira "Ir para
o terminal" e navega direto.

## KW-DIFF

`agentRadar.openDiff` manda o revisor local abrir o `cwd` do agent. O kw-diff é um servidor em
`127.0.0.1:4816` com janela GTK própria: `src/api/helpers/kw-diff.ts` confere `/api/health`, chama o
launcher `kw-diff-open --show` quando o servidor não está de pé e aponta a janela pelo deep-link
`?cwd=<repo>` com `kw-diff-window --show`. Nada do estado do kw-diff é espelhado no Kowork.

"Abrir conversa" escolhe projeto e CLI, aceita primeira mensagem e opções avançadas seguras, cria a
tab por `kwTerminal.sessionStart` e navega ao pane. A barra global usa o mesmo caminho. Essas ações
não escrevem `agent_sessions`, `agent_events` ou `execution_runs`.

`/radar` e `/kw-terminal` deixaram de existir; `/radar` e `/radar/$paneId` seguem como redirects
porque push já entregue aponta para lá.

## JOBS E ARQUIVO /executar

`/executar` redireciona para `/terminals`. `/executar/$id` preserva sessões e runs antigos em modo
somente leitura. Runs novos existem apenas para jobs `merge_action` e `automation`, sempre unattended,
sem `parent_run_id`, sessão continuável ou composer.

Jobs rodam no workspace dedicado `kw_execucoes`, uma tab por run
(`{runId[0:8]}_{titulo}`), sem foco automático. O comando roda via script bash com a saída espelhada
por `tee` para `$TMPDIR/kowork-executions/<runId>.log`; o backend acompanha esse log
(`readNewLogBytes`) e mantém o rastreamento do run (status, passos, output) exatamente como no modo
headless. Exit code sai em `<runId>.exit`. Cancelamento fecha a tab; fechar a tab por fora encerra o
run como cancelado. Fallback: multiplexador diferente de kw-terminal ou falha ao abrir a tab caem no
spawn headless. O watcher do radar exclui esse workspace, portanto o job não ganha entrada
conversacional, preview de transcript ou composer. Implementação: `src/api/helpers/execution-terminal.ts`
e `runViaKwTerminal` em `src/api/helpers/prompt-run.ts`.

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

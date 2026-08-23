# SHELLS

## OBJETIVO

Terminais reais (PTY) embutidos no Kowork pela rota `/shells`, sem kw-terminal nem emulador externo. Cada shell é uma aba com PTY próprio, scrollback que sobrevive a recarregar a página e título publicado pelo CLI que roda dentro.

O `/shells` é a superfície única de terminais: além dos PTYs embutidos, a mesma lista mostra as conversas de agent que hoje nascem em panes do kw-terminal, agrupadas por projeto. A ideia é não precisar mais abrir o kw-terminal/herdr para o dia a dia.

## ARQUITETURA

```
Frontend (React)                      Backend (Bun + ORPC)
┌──────────────────┐                 ┌──────────────────────────────┐
│ xterm.js         │ ◀── stream ──── │ ShellSupervisor              │
│ (@xterm/xterm)   │    (base64)     │   Bun.Terminal (PTY)         │
│  onData → input  │ ── input ────▶  │   @xterm/headless (estado)   │
│  fit → resize    │                 │   ScrollbackRing (1 MB cru)  │
└──────────────────┘                 └────────────┬─────────────────┘
                                                 │ setsid -c $SHELL
                                                 ▼
                                            shell do usuário
```

- **Supervisor** (`src/api/helpers/shells/supervisor.ts`): mapa de shells em memória. Morre junto com o backend — igual às abas do bankai. Não há persistência: reinício de serviço encerra os shells.
- **Motor vt100 server-side** (`@xterm/headless`): todo byte que sai do PTY passa por ele. É quem responde às consultas de capability (DA, CPR, kitty keyboard, OSC) que shells e TUIs mandam ao arrancar. Sem essas respostas o programa do outro lado trava esperando — e um TUI precisa subir mesmo com ninguém olhando a aba.
- **ScrollbackRing** (`scrollback-ring.ts`): últimos 1 MB de saída crua. O replay no attach não passa pelo PubSub — o generator do stream abre com ele e só depois assina o canal vivo, no mesmo bloco síncrono, para nem falhar nem duplicar bytes entre attach e assinatura.
- **Título**: `screen.onTitleChange` captura OSC 0/2 publicado pelo CLI e publica no canal.
- **Saída coalescida**: rajada vira um evento por janela de 8 ms; eco de teclado segue imperceptível e `cat` de arquivo grande não inunda o socket.

## DESFECHO DO PROCESSO

O callback `exit` do `Bun.Terminal` não é confiável quando o filho nasce via `setsid`: o processo morre e o evento fica devendo. O desfecho vem de `proc.exited` — quem garante status, exit code e evento no canal. Os callbacks são idempotentes porque ambos disputam a mesma transição.

## STREAM E INPUT

- Canal PubSub `shells` por `shellId`: `{ type: "data" | "title" | "exit" | "closed" }`.
- `wsRouter.shells.stream` abre com `{ type: "replay", b64 }` e depois espelha o canal.
- Teclado (`shells.input`) e redimensionamento (`shells.resize`) compartilham os procedimentos entre router HTTP e wsRouter: o cliente chama tudo pelo socket do stream.
- O cliente xterm.js também responde consultas ao receber os bytes crus; as respostas dobradas são inofensivas para quem já leu a primeira.

## ROTA /shells

Workspace único, sem `PageShell`:

- **Sidebar** (`-components/shell-sidebar.tsx`): lista unificada de shells e agents agrupados por projeto (cor do projeto + nome; sem projeto agrupa pela pasta). Agents entram na régua do radar — bloqueado primeiro — com ícone do CLI, marca de status, última fala (previews em lote) e botão "focar no terminal"; shells mostram ponto vivo/encerrado, idade e fechar no hover. Colapsa para modo ícone (`kowork-shell-sidebar`).
- **Faixa de abas** (`-components/workspace-tabs.tsx`): chip por shell e por conversa aberta, no molde das tabs do kw-terminal. O ✕ de shell fecha o PTY; conversas só saem da seleção.
- **Conteúdo**: shell ativo renderiza `-components/shell-pane.tsx` (cabeçalho de identidade + xterm.js + overlay de encerrado); conversa ativa renderiza o `AgentConversationView` compartilhado com `/terminals/$paneId`.
- A aba ativa é o search param `?tab=`: `shell-3` para PTY, `agent:<paneId>` para conversa. Deep link funciona e voltar/avançar troca de aba.
- O link antigo `/shells/$shellId` redireciona (replace) para `/shells?tab=<id>`.

## SPLIT VIEW (duas abas)

Qualquer rota pode ser presa à esquerda enquanto a direita continua navegando — o uso principal é o shell fixo à esquerda e o resto do app à direita:

- **Store** (`src/stores/split-view.ts`, `kowork-split-view`): rota fixada (`left`, com search) e largura do painel. Persistida.
- **Router aninhado** (`-components` → `components/layout/pinned-pane.tsx`): a aba esquerda é um segundo router de memória com o mesmo routeTree e o mesmo QueryClient. O contexto leva `nested: true`; com isso `__root` e `_app` renderizam só `<Outlet/>` — sem AppShell, tema duplicado, ErrorBoundary ou segundo Toaster. Os dois históricos são independentes.
- **Divisor** (`SplitPanes` em `app-shell.tsx`): arraste, teclado (setas ±16 px, Shift ±48) e ✕ no hover para desfixar. Largura entre 320 px e 75% da janela.
- **Entradas**: ação "Dividir tela" na sidebar (fixa a rota atual; clica de novo para soltar) e botão "Fixar à esquerda" no header do `/shells`.
- Com sessão fixada à esquerda (rota `/shells*` ou `/terminals*`), a barra de prompt global some junto.

## JANELAS (lógica do bankai)

Implementada em `-components/shell-workspace.tsx`:

- **Divisória**: arraste com ponteiro; teclado com foco no separador (setas ±16 px, Shift ±48 px, Enter entra em modo foco).
- **Largura lembrada**: `localStorage` (`kowork.shells.railWidth`), aplicada no boot da página.
- **Modo foco**: o rail some por inteiro; uma borda rente à esquerda revela o rail em hover e sai do modo no clique ou Escape. Arrastar a divisória abaixo do mínimo também entra. Estado lembrado em `kowork.shells.focusMode`.

## REGRAS

- Erros em pt-BR
- Resize valida limites (2–500 cols, 2–200 rows) antes de tocar o PTY
- Fechar shell manda SIGHUP no grupo (`-pid`) porque o setsid fez do shell líder de sessão; fechar é idempotente — shell morto e clique de fechamento no mesmo instante não quebram
- `cwd` resolvido e validado com `stat` antes do spawn; caminho relativo cai relativo ao processo

## LIMITES CONHECIDOS

- Shells morrem no restart do backend (deploy incluído). Persistir lista e reabrir automaticamente é evolução futura, no padrão do retrato de `agent_session_snapshots`
- Conversas de agent dentro do `/shells` continuam dependendo do daemon kw-terminal (radar + transcript); o que mudou é só a superfície — abrir, acompanhar e responder não exige mais olhar o herdr

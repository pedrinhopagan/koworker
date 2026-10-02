# SHELLS

## OBJETIVO

Terminais reais (PTY) embutidos no Kowork pela rota `/shells`, sem kw-terminal nem emulador externo. Cada shell é uma aba com PTY próprio, scrollback que sobrevive a recarregar a página e título publicado pelo CLI que roda dentro.

O `/shells` é a superfície única de terminais: além dos PTYs embutidos, a mesma lista mostra as conversas de agent que hoje nascem em panes do kw-terminal, agrupadas por projeto. A ideia é não precisar mais abrir o kw-terminal/herdr para o dia a dia.

## ARQUITETURA

```
Frontend (React)                      Backend (Bun + ORPC)
┌──────────────────┐                 ┌──────────────────────────────┐
│ xterm.js         │ ◀── stream ──── │ ShellRuntime                 │
│ (@xterm/xterm)   │    (base64)     │   Bun.Terminal (PTY)         │
│  onData → input  │ ── input ────▶  │   @xterm/headless (estado)   │
│  fit → resize    │                 │   ScrollbackRing (1 MB cru)  │
└──────────────────┘                 └────────────┬─────────────────┘
                                                 │ setsid -c $SHELL
                                                 ▼
                                            shell do usuário
```

- **Runtime** (`src/api/helpers/shells/supervisor.ts`): lifecycle, PTY, VT, replay, metadata, detecção de agent e publicação ficam atrás de `execute`, `snapshot` e `attach`. Relógio, publishers, scanner, screen, terminal e spawn são dependências injetáveis. O mapa vive em memória e morre junto com o backend.
- **Motor vt100 server-side** (`@xterm/headless`): todo byte que sai do PTY passa por ele. É quem responde às consultas de capability (DA, CPR, kitty keyboard, OSC) que shells e TUIs mandam ao arrancar. Sem essas respostas o programa do outro lado trava esperando — e um TUI precisa subir mesmo com ninguém olhando a aba.
- **ScrollbackRing** (`scrollback-ring.ts`): últimos 1 MB de saída crua. O replay no attach não passa pelo PubSub — o generator do stream abre com ele e só depois assina o canal vivo, no mesmo bloco síncrono, para nem falhar nem duplicar bytes entre attach e assinatura.
- **Título**: `screen.onTitleChange` captura OSC 0/2 publicado pelo CLI e publica no canal.
- **Saída coalescida**: rajada vira um evento por janela de 8 ms; eco de teclado segue imperceptível e `cat` de arquivo grande não inunda o socket.
- **Catálogo** (`terminalWorkspace`): snapshot versionado unifica shells e panes de agent. O stream abre com o estado atual, assina antes da leitura e ignora revisões repetidas ou antigas na reconexão.

## DESFECHO DO PROCESSO

O callback `exit` do `Bun.Terminal` não é confiável quando o filho nasce via `setsid`: o processo morre e o evento fica devendo. O desfecho vem de `proc.exited` — quem garante status, exit code e evento no canal. Os callbacks são idempotentes porque ambos disputam a mesma transição.

## STREAM E INPUT

- Canal PubSub `shells` por `shellId`: `{ type: "data" | "title" | "exit" | "closed" }`.
- `wsRouter.shells.stream` abre com `{ type: "replay", b64 }` e depois espelha o canal.
- Teclado (`shells.input`) e redimensionamento (`shells.resize`) compartilham os procedimentos entre router HTTP e wsRouter: o cliente chama tudo pelo socket do stream.
- O cliente xterm.js também responde consultas ao receber os bytes crus; as respostas dobradas são inofensivas para quem já leu a primeira.
- O frontend monta raw PTY e snapshot ANSI sobre `src/lib/terminal-viewport.ts`, que compartilha montagem, foco, links, agendamento de resize, subscription e descarte sem misturar os dois protocolos.

## ROTA /shells

Workspace único, sem `PageShell`:

- **Sidebar** (`-components/shell-sidebar.tsx`): lista unificada de shells e agents agrupados por projeto (logo do projeto + nome; sem projeto agrupa pela pasta). Agents entram na régua do radar — bloqueado primeiro — com ícone do CLI, marca de status, última fala em até 2 linhas (previews em lote) e botão "focar no terminal"; shells mostram ponto vivo/encerrado, idade e o título que o terminal reporta como descrição (título que é a rota não se repete — cai para "ativo"/"encerrado"). Botão direito abre o menu de contexto (`-components/shell-entry-context-menu.tsx`): conversa/focar/tarefa/diff/interromper/fechar no agent, renomear/copiar caminho/abrir pasta/fechar no shell. Colapsa para modo ícone (`kowork-shell-sidebar`).
- **Faixa de abas** (`-components/workspace-tabs.tsx`): chip por shell e por conversa aberta, no molde das tabs do kw-terminal. O ✕ de shell fecha o PTY; conversas só saem da seleção.
- **Conteúdo**: shell ativo renderiza `-components/shell-pane.tsx` (cabeçalho de identidade + xterm.js + overlay de encerrado); conversa ativa renderiza o mesmo `AgentConversationView` dentro do viewport unificado.
- A aba ativa é o search param `?tab=`: `shell-3` para PTY, `agent:<paneId>` para conversa. Deep link funciona e voltar/avançar troca de aba.
- Se a entrada selecionada desaparecer, o workspace escolhe deterministicamente a primeira entrada restante e corrige a URL com `replace`.
- `/terminals` e `/terminals/$paneId` são deep links legados e redirecionam com `replace`; `/terminals/history/**` continua sendo a superfície de arquivo.
- O link antigo `/shells/$shellId` redireciona (replace) para `/shells?tab=<id>`.

## SPLIT VIEW (rota fixada à esquerda)

Uma rota fica presa num painel próprio à esquerda (padrão: Shells) enquanto a área principal navega o resto do app à direita:

- **Shift+clique na navegação** (`src/hooks/use-pin-left.ts`): é assim que se entra (ou troca) o split — sem dialog. Shift+clique numa rota da sidebar fixa ela à esquerda (entrando no modo dividido se preciso); o clique normal segue navegando a área principal à direita. Se a rota fixada é a mesma que está na área principal, ela recua para a Home para não duplicar. Aplicado a partir do `/shells`, o `?tab=` atual vai junto; fixado o root pelado, o painel não rebaixa a rota.
- **Store** (`src/stores/split-view.ts`, `kowork-split-view`): rota fixada (`path`, qualquer raiz de rota), largura do painel, flag de arrasto (`resizing`) e contador `pulse`. Persistidos path + width.
- **Router aninhado** (`components/layout/pinned-pane.tsx`): a aba esquerda é um segundo router de memória com o mesmo routeTree e o mesmo QueryClient. O contexto leva `nested: true`; com isso `__root` e `_app` renderizam só `<Outlet/>` — sem AppShell, tema duplicado, ErrorBoundary ou segundo Toaster. Os dois históricos são independentes.
- **O que estava aberto se mantém**: fixado a partir do `/shells`, o `?tab=` atual vai junto no shift+clique; fixado o root pelado (`/shells` sem aba), o painel não rebaixa a rota — o router de memória é singleton e retoma a última conversa/terminal exibido. Fechar e reabrir a divisão na mesma sessão restaura o estado do painel.
- **Instância única**: com a divisão aberta, o item da sidebar correspondente à rota fixada não navega — dispara um pulso (anel) no painel. O ✕ no hover da divisória solta o painel.
- **Divisória** (padrão Bankai: hook `src/hooks/use-divider.ts` + componente `components/layout/divider.tsx`): pointer capture na própria divisória (o arrasto sobrevive a passar sobre o xterm), delta a partir do início do gesto, largura aplicada direto na CSS var `--shell-pane-width` fora do render do React e commitada no store só no ponteiro-up. Teclado no separador: setas ±16 px, Shift ±48 px. Hairline de 1 px com hit area de 13 px, brilha em hover/arrasto/foco.
- **Limites**: mínimo de 320 px para o painel e 420 px reservados à área principal; o teto acompanha a largura da linha via ResizeObserver e encolhe junto quando a janela aperta.
- **Terminal estável durante o arrasto** (`-components/shell-terminal.tsx`): com `resizing` ativo o fit do xterm e o resize do PTY ficam adiados; ao soltar, um único fit finaliza.
- **Medida de redraw e resize**: no fixture 80 × 24 com uma linha alterada, o frame inteiro tem 1.943 bytes e o patch tem 99 bytes. Uma rajada de 50 notificações de resize durante o arrasto produz zero layouts no gesto e um layout ao soltar; os testes fixam os dois orçamentos.
- A barra de prompt global continua visível com a divisão aberta; ela só some quando a própria rota da área principal é `/shells*`, que tem composer próprio.

## JANELAS

`-components/shell-workspace.tsx` é só layout: rail + faixa de abas + conteúdo no desktop; no celular somem rail e separador. Quem controla expandir/recolher é a própria sidebar.

## REGRAS

- Erros em pt-BR
- Resize valida limites (2–500 cols, 2–500 rows) antes de tocar o PTY
- Fechar shell manda SIGHUP no grupo (`-pid`) porque o setsid fez do shell líder de sessão; fechar é idempotente — shell morto e clique de fechamento no mesmo instante não quebram
- `cwd` resolvido e validado com `stat` antes do spawn; caminho relativo cai relativo ao processo
- O runtime é single-tenant: o servidor recusa inicialização quando encontra mais de um usuário, porque PTYs e processos do host ainda não são particionados por identidade.

## LIMITES CONHECIDOS

- Shells morrem no restart do backend (deploy incluído). Persistir lista e reabrir automaticamente é evolução futura, no padrão do retrato de `agent_session_snapshots`
- Conversas de agent dentro do `/shells` continuam dependendo do daemon kw-terminal (radar + transcript); o que mudou é só a superfície — abrir, acompanhar e responder não exige mais olhar o herdr

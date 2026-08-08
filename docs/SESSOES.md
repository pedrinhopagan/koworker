# ARQUIVO DE SESSÕES DE AGENTE

`agent_sessions` e `agent_events` preservam conversas criadas pelo executor headless anterior. Não
participam de conversas novas.

## Contrato atual

- `agentSessions.get`, `agentSessions.list` e `agentSessions.resolveRun` são somente leitura.
- `/executar/$executionId` abre sessão ou run antigo sem composer, continue, retry conversacional,
  permissão, resposta, interrupção, retomada ou mudança de modo.
- `src/api/helpers/agent-session/reader.ts` lê eventos diretamente do banco. Não há registry de
  processos, reconciler, WebSocket `agentSession` ou endpoint MCP de sessão.
- A migração encerra linhas antigas com `status = live`, preservando sessões já encerradas.
- O schema e os parsers permanecem para leitura durante a janela de compatibilidade.

## Conversas atuais

Conversas novas pertencem a panes do kw-terminal e usam `paneId` como identidade enquanto estão
abertas. O mapa vem do daemon e a timeline usa o `sessionPath` reportado pelo CLI ou o transcript raiz
derivado dos PIDs exatos do pane: arquivo aberto no Codex e registro `~/.claude/sessions/<pid>.json`
no Claude. Novas sessões instalam a integração oficial antes de iniciar o CLI. Veja
`docs/TERMINAL.md`.

## Jobs

`execution_runs` recebe apenas flows e jobs unattended (`merge_action` ou `automation`). Jobs não
criam `agent_sessions`, não encadeiam turnos e não persistem sessão de CLI. `/executar/$id` continua
mostrando status, passos e saída; cancelamento e repetição existem somente para jobs atuais.

## Corte posterior

A remoção física de `agent_sessions`, `agent_events`, `agent_session_snapshots` e leitores depende de
uma janela de compatibilidade e medição dos acessos a IDs antigos.

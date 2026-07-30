# API AGENTS

## OBJETIVO

Padronizar ORPC, validação e regras de auth para o backend.

## REGRAS

- Router único em `src/api/router.ts` agregando subrouters
- Subrouters ficam em `src/api/routers/` (ex: `projects.ts`, `tasks.ts`)
- Schemas ficam em `src/api/schemas/` usando Zod
- Mensagens de erro sempre em pt-BR
- `publicProcedure` e `protectedProcedure` devem ser usados para auth
- `localProcedure` é o terceiro nível: exige sessão, dispositivo aprovado e requisição de loopback.
  É o que governa `devices.*` — só a máquina que roda o Kowork libera outro aparelho
- Mutations de tasks publicam eventos via PubSub

## NOMENCLATURA

- `router.projects.create` / `router.tasks.update`
- `wsRouter.tasks` para o stream de eventos de task; os demais streams são `notifications`,
  `navigate`, `flow`, `promptRun`, `agentSession` e `terminal`

## PORTÃO DE DISPOSITIVO

- Toda sessão nasce presa a uma linha de `devices`: o `deviceId` viaja no JWT e o cookie `device`
  (1 ano) mantém a identidade do aparelho entre logins.
- Login de loopback aprova o aparelho na hora; qualquer outra origem entra `pending`, recebe sessão
  que não abre rota protegida e dispara notificação (PubSub + push) pedindo liberação no PC.
- `protectedProcedure` devolve `FORBIDDEN` com `data.reason = DEVICE_NOT_APPROVED` enquanto o
  aparelho não for liberado; o front desvia pra rota `/dispositivo`.
- O upgrade de `/ws` valida a origem contra a allowlist do CORS e recusa dispositivo não aprovado.
  Bloquear ou revogar fecha os sockets daquele aparelho na hora.

## STATUS DE TASK

- `tasks` não tem coluna `status`. A conclusão é `done` (0/1) mais `completed_at`.
- Execução vive em `execution_runs` (`kind`: `prompt | flow`; `status`: `running | done | failed | timeout | waiting_user | cancelled`).
- A etapa do fluxo é inferida dos artefatos da pasta da task (`inferTaskStage`), não persistida.

## SESSÃO DE AGENTE

- `agentSessions.*` fala com um processo do CLI que fica de pé entre turnos; cada turno abre um
  `execution_runs` com `session_id`. Os blocos da conversa vivem em `agent_events` e chegam ao vivo
  pelo canal `agentSession`. Só o registry escreve no stdin do processo — protocolo e ciclo de vida
  em `docs/SESSOES.md`.
- A rota `/mcp/session/:sessionId` no `server.ts` é o servidor MCP que entrega a pergunta com opções
  ao usuário. Só loopback: a porta é pública na VPS.

## CONVERSA DE EXECUÇÃO (chamada única)

- Vale para o Codex e para todo run anterior às sessões.
- Os turnos de uma conversa são runs distintos ligados por `parent_run_id` e agrupados por
  `cli_session_id`. `prompt.thread` devolve a conversa inteira; `prompt.continue` abre o próximo turno
  retomando a sessão do CLI (`--resume` no Claude, `codex exec resume`).
- Os CLIs rodam em JSONL (`--output-format stream-json` no Claude, `--json` no Codex) e
  `lib/agent-stream.ts` traduz cada linha em passos (`AgentStep`) com ferramenta, alvo e desfecho.
- Os passos ficam em memória (`helpers/run-steps.ts`), não no banco: chegam ao vivo pelo canal
  `promptRun` (`status: "step"`) e são reidratados por `prompt.runSteps` em cada reconexão.

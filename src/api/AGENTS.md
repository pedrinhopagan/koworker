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
  `navigate`, `promptRun`, `conversation`, `conversations`, `conversationPane`, `agentRadar`, `agentRadarTranscript`,
  `agentTerminal`, `terminalWorkspace`, `modelCatalog`, `shells` e `terminal`

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

## CONVERSA NATIVA

- `conversations.*` autoriza cada conversa pelo `user_id`. O runtime em `helpers/conversations/`
  mantém um Codex App Server por perfil e direciona eventos por `(profileId, threadId)`.
- `conversation_messages` persiste o envio antes do RPC. `clientMessageId` vai como
  `clientUserMessageId` e a confirmação vem de `userMessage.clientId`. A releitura do histórico e
  as notificações entram na mesma fila para preservar a ordem do protocolo.
- Pedidos nativos usam `requestId` mais `runtimeId`; a resposta espera `serverRequest/resolved`.
- O boot limpa pedidos de processos encerrados e marca envios interrompidos como incertos.
  A retomada usa `thread/resume`; a conferência explícita usa `thread/read`.
- `cliHistory` pagina `thread/list` e filtra pelo diretório do projeto; `importCli` valida
  `thread/read` e vincula a identidade nativa, preservando histórico e cwd. Uma conversa aberta
  no radar reutiliza seu pane; o runtime impede a retomada simultânea pelo app.
- `conversations.pane` e o stream `conversationPane` leem o Codex aberto por `thread/read`,
  usando o CODEX_HOME do rollout. O stream confere mudanças enquanto houver leitor, envia apenas
  snapshots diferentes e encerra a espera ao cancelar a assinatura.

## HISTÓRICO E JOBS

- `agentSessions.*` é somente leitura do executor anterior. Contrato em `docs/SESSOES.md`.
- Jobs atuais usam `execution_runs` e `promptRun`; os passos são interpretados por
  `lib/agent-stream.ts` e reidratados por `prompt.runSteps`.

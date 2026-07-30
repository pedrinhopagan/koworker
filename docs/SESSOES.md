# SESSÕES DE AGENTE

Executar é conversar: `/executar` abre um chat vazio, a primeira mensagem cria a sessão e a rota vira
`/executar/<sessionId>` com a conversa já carregada. Os dois CLIs viram sessão, mas não do mesmo
jeito.

| | `claude` | `codex` |
|---|---|---|
| Processo | um só, vivo entre turnos | um por turno |
| Continuidade | handshake + stdin | `codex exec resume <thread>` |
| Id da conversa | o `id` da linha (`--session-id`) | o `thread_id` que o CLI batiza, em `cli_session_id` |
| Permissão | `can_use_tool` respondido em quente | política fixada no spawn de cada turno |
| Perguntar | MCP `ask_user` | MCP `ask_user` (via `-c mcp_servers.koworker.url`) |
| Interromper | `control_request` | matar o processo do turno |

A sessão do codex existe mesmo sem processo: entre turnos ela é a linha do banco mais o `thread_id`,
e é por isso que retomar não custa nada. A do claude morre com o processo.

## O que a CLI exige (verificado no `claude` 2.1.220)

**O handshake é o que mantém o processo vivo.** Com `-p --input-format stream-json --output-format
stream-json --verbose`, escrever `{"type":"control_request","request":{"subtype":"initialize"}}` na
primeira linha do stdin põe o CLI em modo sessão: depois do `result` ele continua aceitando turnos.
Sem o handshake o processo encerra no fim do primeiro turno, mesmo com stdin aberto.

**Turno** é `{"type":"user","message":{"role":"user","content":"…"}}` no stdin do processo vivo.

**`AskUserQuestion` não existe no modo `-p`.** O `system/init` lista as ferramentas disponíveis e ela
não está lá. Perguntar com opções exige a ferramenta MCP própria descrita abaixo.

**Permissão** chega como `control_request` de subtipo `can_use_tool` porque a sessão sobe com
`--permission-prompt-tool stdio` (flag oculta). A resposta é um `control_response` com
`{behavior:"allow", updatedInput}` ou `{behavior:"deny", message}` — o `updatedInput` precisa ecoar o
input original, por isso ele fica guardado em memória junto do pedido.

Outros subtipos usados: `interrupt` (parar o turno) e `set_permission_mode` (trocar o modo em quente).

## O que a CLI exige (verificado no `codex` 0.145.0)

**Não existe canal de controle.** `codex exec --json` transmite JSONL e morre no fim do turno. A
continuidade é `codex exec resume <thread_id> "<prompt>"`, que devolve o contexto inteiro no processo
seguinte.

**O `thread_id` é do CLI, não nosso.** Ele chega na primeira linha (`thread.started`) e é gravado em
`agent_sessions.cli_session_id` na hora: sem ele não há resume.

**Permissão não é perguntável em quente.** A política vai na linha de comando (`--full-auto`,
`--sandbox read-only`, `--dangerously-bypass-approvals-and-sandbox`), então trocar o modo vale do
próximo turno em diante. Não existe bloco `permission` numa sessão codex.

**MCP entra pela config**: `-c mcp_servers.koworker.url="http://127.0.0.1:<porta>/mcp/session/<id>"`.
É o mesmo servidor do claude, e é assim que a pergunta com opções também funciona aqui.

## Peças

| Arquivo | Papel |
|---|---|
| `src/api/helpers/agent-session/registry.ts` | Dono dos processos: spawn, handshake, turno, permissão, pergunta, encerrar, retomar, heartbeat |
| `src/api/helpers/agent-session/mcp.ts` | Servidor MCP (HTTP) com a ferramenta `ask_user` |
| `src/lib/claude-session-stream.ts` | Traduz o stdout do `claude` nos blocos da conversa |
| `src/lib/codex-session-stream.ts` | Traduz o JSONL do `codex` nos mesmos blocos |
| `src/lib/agent-session.ts` | Shape dos blocos, o patch que os dois tradutores devolvem, merge por `seq` |
| `src/api/routers/agent-sessions.ts` | Boundary ORPC; `start` já devolve a conversa inteira |
| `src/hooks/use-agent-session.ts` | Leitura + assinatura no front |
| `src/routes/_app/executar/` | O chat vazio que cria a sessão |
| `src/routes/_app/executar/$executionId/` | A rota da sessão |

## Perguntar ao usuário

O servidor sobe a sessão com `--mcp-config` apontando para `http://127.0.0.1:<porta>/mcp/session/<id>`
— uma rota do próprio koworker, só loopback. A ferramenta `ask_user` recebe pergunta e 2 a 4 opções,
grava um bloco `question`, dispara push e **fica pendurada** até a resposta chegar pela rota; só então
o resultado da ferramenta volta ao agente. Sem resposta em 30 minutos, ela devolve que ninguém
respondeu, em vez de segurar o agente para sempre.

`--allowedTools mcp__koworker__ask_user` evita pedir permissão para poder perguntar.

## Ciclo de vida

- Uma sessão `live` por tarefa (índice único parcial em `agent_sessions`).
- Heartbeat a cada 30s; sessão `live` sem sinal de vida e sem processo neste executor vira `crashed`
  na reconciliação — o processo só existe na memória de quem o criou.
- Restart do servidor encerra as sessões (`shutdownSessions`); retomar é manual.
- Retomar sobe `--resume <sessionId>` no mesmo `cwd`, recusando quando o `main_route` do projeto
  mudou desde o start. No codex retomar nem sobe processo: basta a sessão voltar ao registry.
- Toda conversa aberta pelo chat nasce amarrada a uma tarefa, existente ou criada na hora: é o que
  garante a pasta com os `.md` do trabalho. Sem título, o agente batiza no primeiro passo.
- Sessão com tarefa mostra o link dela em toda superfície do executor (cabeçalho da sessão, lista de
  sessões, card do histórico e conversa de chamada única), pelo componente `TaskLink`. O turno herda
  a tarefa da sessão, então nunca existe run com tarefa que a sessão não tenha.
- O turno tem teto de 45 min. A sessão ociosa não tem: agente parado esperando você não é agente
  travado.

## Regras

- Nada de escrever no stdin fora do registry: a ordem das mensagens é o estado da sessão.
- Tradutor novo devolve `AgentSessionPatch`, nunca bloco pronto: quem grava e publica é o registry.
- Bloco que muda de estado (ferramenta que termina, permissão respondida, pergunta respondida) é
  atualizado pelo `seq`, nunca duplicado.
- O `cwd` da sessão é congelado; validar diretório antes de subir e antes de retomar.
- Erro em pt-BR, como no resto do app.

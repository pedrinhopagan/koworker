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

`/chat?id=<uuid>` usa Codex App Server em stdio. `conversations` guarda o dono, projeto, perfil,
thread e projeção; `conversation_messages` guarda a outbox. O runtime vive em
`src/api/helpers/chattions/`, com um processo por perfil (`codex` ou `codex-personal`).

A identidade durável é `(profile_id, thread_id)`, com `cwd` congelado na criação. Envios levam
`clientUserMessageId`; itens `userMessage.clientId` confirmam a entrega. Timeouts ficam incertos
até a conferência do histórico. Decisões levam `requestId` e `runtimeId` e esperam a resolução
nativa. O boot limpa pedidos expirados e sinaliza envios interrompidos. A thread é retomada ao abrir.

A sidebar mostra as conversas do projeto selecionado e o histórico do Codex por conta, lido via
`thread/list`. Trazer para o app usa `thread/read`, preserva o histórico e o diretório e reutiliza
o registro em importações repetidas. Conversas novas e importadas começam com acesso completo;
na criação, o seletor permite escolher acesso ao projeto. Threads abertas no radar
ficam no pane existente, acessível em `/chat?paneId=<id>`, com conversa e terminal. A seção
Agents abertos acompanha todos os projetos, com estado e resumo recebidos do radar e dos transcripts.

Conversas em `/chat?paneId=<id>` pertencem a panes do kw-terminal e usam `paneId` enquanto estão abertas.
O mapa vem do daemon e a timeline usa o `sessionPath` reportado pelo CLI ou o transcript raiz
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

## Apresentação em /chat

`/conversa` redireciona para `/chat`, preservando o ID da conversa ou do pane.

Conversas nativas do app e panes do Codex usam a mesma apresentação de turnos e itens em `/chat`. A fase `commentary` permanece na posição original; `final_answer` recebe a ação de copiar. Ferramentas consecutivas podem ser recolhidas, mas as falas não são rearranjadas. Raciocínio sem texto legível fica oculto. Entradas, resultados, códigos de saída e diffs ficam disponíveis ao expandir a atividade; saídas grandes só entram no DOM quando abertas.

Para um pane, `conversations.pane` resolve o rollout pelo radar e lê `thread/read` no CODEX_HOME correspondente, sem `thread/resume`. O stream `conversationPane` verifica mudanças no rollout e no histórico paginado enquanto a conversa está aberta, envia apenas snapshots diferentes e cancela a espera ao sair. A identidade nativa reinicia a rolagem quando o CLI troca de sessão. O envio e as interações bloqueantes continuam no pane original.

O adapter das outras CLIs preserva a ordem dos eventos do leitor existente e os converte para a apresentação comum. Claude Code mantém suas mensagens, ferramentas, perguntas e desfechos por esse caminho. A integração nativa de execução permanece a do Codex.

A sidebar coloca agents abertos no topo. O histórico do projeto combina conversas salvas e da CLI por atualização, mostra três entradas e cresce com Ver mais. A expansão pertence à página e se desfaz ao sair de `/chat`.

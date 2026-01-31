# Terminal (Tauri + tmux)

Este modulo concentra a logica do terminal por tarefa.

## Objetivo
- Manter sessoes vivas mesmo fora da tela da task
- Reaproveitar o mesmo terminal ao voltar para a tarefa
- Destacar tarefas com terminal ativo no UI

## Componentes
- `terminal-manager.tsx`: renderiza todos os terminais ativos e mantem vivos fora da tela
- `terminal-mount.tsx`: ponto de montagem usado pela pagina da task
- `store.ts`: estado compartilhado das sessoes e mounts
- `hooks.ts`: logica de tmux e estado de UI por task
- `utils.ts`: helpers para sessao tmux e scripts bash

## Fluxo
1. Pagina da task registra o mount (`TerminalMount`)
2. `TerminalManager` cria o terminal e renderiza via portal
3. Ao sair da pagina, o slot some mas o terminal continua vivo fora da tela
4. Ao voltar, o mesmo terminal reaparece com todo o buffer

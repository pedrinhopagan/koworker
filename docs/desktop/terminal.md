# Terminal e tmux

## Objetivo

Abrir um terminal externo e anexar em uma sessao tmux, com configuracao simples por SO.

## Modo simples

1. App escolhe um terminal conhecido (preset `auto`)
2. Abre o terminal externo
3. Executa `tmux new-session -A -s <sessao>`

## Presets sugeridos

Linux
- `konsole`
- `gnome-terminal`
- `alacritty`
- `kitty`
- `wezterm`

macOS
- `terminal`
- `iterm`

## Noob-friendly

- `auto` tenta presets conhecidos por SO
- Se falhar, a UI mostra uma lista com um botao de teste
- O usuario nao precisa editar comandos manualmente

## Observacoes

- A sessao tmux padrao e `kowork`
- A UI deve permitir trocar o nome da sessao

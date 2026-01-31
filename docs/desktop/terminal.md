# Terminal (embutido) + fallback tmux

## Objetivo

O padrão do Kowork Desktop é ter **terminal embutido** no app (xterm.js no front + PTY real no Rust/Tauri), suportando TUIs (ex.: `opencode`).

Como fallback (opcional), o app pode abrir um **terminal externo** e anexar em uma sessão tmux.

## Terminal embutido (padrão)

- Front: xterm.js
- Backend: PTY no Rust/Tauri (não usar `tauri-plugin-shell` como substituto de PTY)
- Contrato mínimo:
  - `pty.create({ cwd, cmd, args, env, cols, rows }) -> { sessionId }`
  - `pty.write({ sessionId, data })`
  - `pty.resize({ sessionId, cols, rows })`
  - `pty.kill({ sessionId })`
  - eventos `pty:data` e `pty:exit`

Guardrails (MVP):
- restringir `cwd` ao root do projeto e allowlist de diretórios
- spawn via `{cmd,args[]}` (sem `sh -c`)
- sanitizar env (não logar secrets)
- encerrar sessões ao fechar a task/app

## Terminal externo + tmux (fallback)

1. App escolhe um terminal conhecido (preset `auto`)
2. Abre o terminal externo
3. Executa `tmux new-session -A -s <sessao>`

## Presets sugeridos (fallback tmux)

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

# TAURI AGENTS

## OBJETIVO

Wrapper desktop leve para o app React. Responsável por: janela, instância única (socket de controle) e tray.

## ESTRUTURA

```
src-tauri/
├── src/
│   └── lib.rs           # Entry point
├── Cargo.toml
├── tauri.conf.json      # Configuração do Tauri
└── icons/
```

## REGRAS

- Tauri é wrapper, não tem lógica de negócio
- Comandos Tauri para funcionalidades nativas (shortcut, window, tray)
- Frontend se comunica via ORPC para dados e terminais
- Manter configuração mínima

## JANELA

- Inicia oculta (`visible: false`); `--show` ou `--toggle` na argv abre visível
- Sem decorações nativas (`decorations: false`)
- Janela normal na taskbar (`skipTaskbar: false`); fechar esconde pra tray
- Toggle NÃO usa shortcut global do Tauri (grab X11 não funciona em sessão Wayland): o atalho é
  registrado no KDE (Alt+K prod / Alt+L dev) e executa `kowork --toggle`
- `ipc.rs`: socket Unix em `$XDG_RUNTIME_DIR/kowork{-dev}.sock`; segunda instância encaminha
  `show|hide|toggle` pra instância viva e sai

## BUILD

- Dev: `frontendDist` aponta para localhost
- Prod: `frontendDist` aponta para `../dist`

## DEV VS PROD (ÍCONE E IDENTIDADE)

- `tauri.dev.conf.json` (merge via `--config` nos scripts `dev`/`tauri:dev`) troca `bundle.icon` pelos ícones âmbar de `icons/dev/` (janela + tray)
- Builds debug setam prgname/WM_CLASS `kowork-dev` e título `Kowork Dev` em `lib.rs`; o KDE casa a janela com `~/.local/share/applications/kowork-dev.desktop` (Icon=kowork-dev no hicolor) na taskbar/alt-tab
- Ícones dev gerados de `icons/dev/logo.svg` (recolor do `icons/logo.svg`) com `rsvg-convert`

## COMANDOS RUST

Adicionar novos comandos em `lib.rs`:

```rust
#[tauri::command]
fn meu_comando() -> Result<String, String> {
    Ok("resultado".to_string())
}
```

Registrar no builder:

```rust
.invoke_handler(tauri::generate_handler![meu_comando])
```

Terminais são gerenciados pelo backend Bun (ORPC). Ver `docs/TERMINAL.md`.

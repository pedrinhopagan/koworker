# TAURI AGENTS

## OBJETIVO

Wrapper desktop leve para o app React. Responsável por: janela, shortcut global, tray e gerenciamento de terminais tmux.

## ESTRUTURA

```
src-tauri/
├── src/
│   ├── lib.rs           # Entry point
│   └── terminal.rs      # Comandos de terminal (tmux)
├── Cargo.toml
├── tauri.conf.json      # Configuração do Tauri
└── icons/
```

## REGRAS

- Tauri é wrapper, não tem lógica de negócio (exceto terminal)
- Comandos Tauri para funcionalidades nativas (shortcut, window, tray, terminal)
- Frontend se comunica via ORPC para dados, Tauri IPC para terminal
- Manter configuração mínima

## JANELA

- Inicia oculta (`visible: false`)
- Sem decorações nativas (`decorations: false`)
- Shortcut global (Alt+O) toggle visibilidade
- Skip taskbar quando minimizada

## BUILD

- Dev: `frontendDist` aponta para localhost
- Prod: `frontendDist` aponta para `../dist`

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

## COMANDOS DE TERMINAL

Os comandos de terminal estão em `terminal.rs`. Ver documentação completa em `docs/TERMINAL.md`.

| Comando | Descrição |
|---------|-----------|
| `open_terminal_for_task` | Abre/cria sessão tmux e window para tarefa |
| `close_project_session` | Fecha sessão tmux inteira do projeto |
| `close_task_window` | Fecha apenas a window de uma tarefa |
| `get_active_sessions` | Lista sessões ativas |
| `check_session_exists` | Verifica se sessão existe |

**Importante:** Usar `#[tauri::command(rename_all = "camelCase")]` para parâmetros.

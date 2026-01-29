# TAURI AGENTS

## OBJETIVO

Wrapper desktop leve para o app React. Responsável por: janela, shortcut global, tray.

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
- Comandos Tauri só para funcionalidades nativas (shortcut, window, tray)
- Frontend se comunica via ORPC, não via comandos Tauri
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

# Desktop (Tauri 2 + Bun)

## Objetivo

Criar uma base simples e robusta para rodar no desktop com o minimo de Rust, mantendo o core em TS/Bun.

## Arquitetura

- Host desktop: Tauri 2 (janela e IPC)
- Core: Bun sidecar (toda a logica de agentes, terminal e SDKs)
- UI: React + TanStack (somente consumo de eventos)

## Backend local

O app desktop depende do backend ORPC rodando em `http://localhost:3000` (HTTP + WS). Sem isso, o front não carrega dados. Para builds estáticos, também é possível definir `window.__KOWORK_API_URL__` antes do bundle carregar.

No desktop, o app tenta subir o backend via `bun` automaticamente quando abre. Se já existir um backend rodando na porta 3000, ele não inicia outro.

## Estrutura proposta

```
src/
  desktop/
    config.ts
    providers/
    terminal/
```

## Fluxos principais

### Selecionar SDK

Um unico input define o provedor ativo. O core carrega o adapter correto e mantem a mesma interface para todos.

Veja `docs/desktop/provedores.md`.

### Terminal e tmux

No modo simples, o app abre um terminal externo e anexa em uma sessao tmux.

Veja `docs/desktop/terminal.md`.

## Noob-friendly

- Modo padrao: `auto`
- Escolhe um terminal conhecido por SO
- Se falhar, o usuario escolhe na UI com um teste simples

## Proximos passos sugeridos

- Criar o host Tauri e o sidecar Bun
- Criar uma tela simples de configuracao
- Integrar o provedor mock para validacao de fluxo

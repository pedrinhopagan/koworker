# Desktop (Tauri 2 + Bun)

## Objetivo

Criar uma base simples e robusta para rodar no desktop com o minimo de Rust, mantendo o core em TS/Bun.

## Arquitetura

- Host desktop: Tauri 2 (janela e IPC)
- Core: Bun sidecar (toda a logica de agentes, terminal e SDKs)
- UI: React + TanStack (somente consumo de eventos)

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

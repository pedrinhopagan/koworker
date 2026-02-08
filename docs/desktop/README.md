# Desktop (Tauri 2 + Bun)

## Objetivo

Criar uma base simples e robusta para rodar no desktop com o minimo de Rust, mantendo o core em TS/Bun.

## Arquitetura

- Host desktop: Tauri 2 (janela, IPC e backend Rust)
- UI: React + TanStack
- Backend local (TS/Bun): ORPC/API e integrações
- **Terminal integrado (MVP): xterm.js no front + PTY real no Rust/Tauri** (para suportar TUIs como `opencode`)

> Nota: a abordagem antiga de “terminal externo + tmux” permanece como fallback opcional, mas o padrão do produto é terminal embutido.

## Backend local

O app desktop depende do backend ORPC rodando em `http://localhost:3000` (HTTP + WS). Sem isso, o front não carrega dados. Para builds estáticos, também é possível definir `window.__KOWORK_API_URL__` antes do bundle carregar.

No desktop, o app tenta subir o backend automaticamente quando abre. Se já existir um backend rodando na porta 3000, ele não inicia outro.

- Em desenvolvimento, sobe via `bun --watch src/server.ts`.
- Em build de produção, sobe via binário `kowork-backend` empacotado no bundle Tauri.

## Build de produção (Linux)

```bash
bun run desktop:build
```

Pipeline executado:

1. `desktop:prepare`
2. Build web em `dist/`
3. Build backend compilado em `src-tauri/bin/kowork-backend`
4. `cargo tauri build`

Artefatos finais ficam em `src-tauri/target/release/bundle/`.

## Atualizar e rebuildar do remoto

```bash
bun run desktop:update
```

Esse comando:

1. Faz `git fetch origin --prune`
2. Usa `origin/master` (ou fallback para `origin/main`)
3. Cria um worktree temporário nessa referência
4. Instala dependências e gera o build desktop
5. Copia os artefatos para `releases/linux/<branch>-<sha>-<timestamp>/`
6. Atualiza o atalho `releases/linux/latest`

## Inicialização com o desktop

No Linux (apenas build de produção), o app cria/atualiza automaticamente:

`~/.config/autostart/kowork.desktop`

Assim o Kowork inicia junto com a sessão do usuário.

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

### Terminal

O padrão é **terminal embutido** (xterm.js + PTY no Rust/Tauri). Isso permite rodar CLIs interativas (ex.: `opencode`) dentro do app.

Fallback opcional: abrir **terminal externo + tmux** (mantido para ambientes onde o PTY embutido falhar ou por preferência do usuário).

Veja `docs/desktop/terminal.md`.

## Noob-friendly

- Modo padrao: `auto`
- Escolhe um terminal conhecido por SO
- Se falhar, o usuario escolhe na UI com um teste simples

## Proximos passos sugeridos

- Criar o host Tauri e o sidecar Bun
- Criar uma tela simples de configuracao
- Integrar o provedor mock para validacao de fluxo

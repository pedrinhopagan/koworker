# Koworker

ERP full-stack brasileiro focado em projetos e tarefas com AI Coding Agents.

## Requisitos

### Runtime

- [Bun](https://bun.sh) (runtime e package manager)
- [Rust + Cargo](https://rustup.rs) (para o Tauri)
- `cargo-tauri` — instale com `cargo install tauri-cli`

### Dependências de sistema (Linux)

O Tauri precisa de libs nativas para compilar. No Arch/CachyOS:

```bash
sudo pacman -S webkit2gtk-4.1
```

No Ubuntu/Debian:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf
```

## Setup

O comando `bun setup` prepara tudo de uma vez:

```bash
bun setup
```

O que ele faz:

1. Copia `.env.example` → `.env` (se não existir)
2. Instala dependências (`bun install`)
3. Cria o banco SQLite e roda migrações
4. Roda seed (usuário admin, categorias, prioridades, skills)
5. Builda o frontend em `dist/`
6. Compila o backend binary em `src-tauri/bin/kowork-backend`
7. Verifica se `cargo-tauri` e `webkit2gtk` estão instalados

Após o setup, rode:

```bash
bun dev
```

## Banco de dados

O Koworker usa **SQLite** como banco local via `@lobomfz/db` + **Kysely** (query builder).

- O arquivo do banco é definido pela variável `DATABASE_URL` no `.env` (padrão: `db.sqlite` na raiz do projeto)
- O schema é declarado com **Arktype** em `src/api/db/connection.ts`
- Migrações são idempotentes e rodam automaticamente ao iniciar o servidor (`src/api/db/migrate.ts`)
- Não precisa de servidor de banco — é um arquivo local

### Tabelas

| Tabela           | Descrição                           |
| ---------------- | ----------------------------------- |
| `users`          | Usuários (admin/user)               |
| `projects`       | Projetos com rotas e cor            |
| `project_routes` | Rotas/abas dentro de cada projeto   |
| `tasks`          | Tarefas vinculadas a projeto        |
| `subtasks`       | Subtarefas de uma task              |
| `categories`     | Categorias (feature, fix, test, doc)|
| `priorities`     | Prioridades (Alta, Media, Baixa)    |
| `skills`         | Skills para AI agents               |

### Seed

O seed (`bun seed`) cria:

- Usuário `admin` com senha `password`
- Categorias padrão: feature, fix, test, doc
- Prioridades padrão: Alta, Media, Baixa
- Skills builtin importadas de `~/.config/opencode/skills/` ou `static/skills/`

### Resetar o banco

Para resetar o banco completamente:

```bash
rm db.sqlite && bun seed
```

O servidor recria as tabelas automaticamente ao iniciar.

## Stack

### Frontend

- **React 19** + **TanStack Router** (file-based) + **TanStack Query**
- **Zustand** (state management)
- **Tailwind 4** + **Radix UI + shadcn**

### Backend

- **Bun** (runtime + server)
- **ORPC** (HTTP em `/rpc` + WebSocket em `/ws`)
- **Kysely** + **SQLite** via `@lobomfz/db`

### Validação

- **Zod** — validação geral (schemas de API, CLI)
- **Arktype** — schema do banco de dados

### Desktop

- **Tauri 2** — wrapper desktop com window management e global shortcuts

## Estrutura

```
src/
├── api/           # ORPC routers, auth, schemas, db, pubsub
├── routes/        # TanStack Router (file-based)
├── components/    # UI (shadcn + base)
├── hooks/         # Custom React hooks
├── lib/           # Utilitários
├── stores/        # Zustand stores
├── types/         # TypeScript types
├── cli/           # CLI Kowork (acesso direto ao DB)
├── desktop/       # Integração Tauri
├── server.ts      # Entry point do backend Bun
└── main.tsx       # Entry point do frontend React

src-tauri/         # App Tauri (Rust)
scripts/           # Setup, seed, build, deploy
docs/              # Documentação adicional
```

## Comandos

### Desenvolvimento

```bash
bun setup          # Prepara tudo (env, db, builds)
bun dev            # Dev completo (frontend + backend + Tauri)
bun dev:web        # Apenas frontend + backend (sem Tauri)
```

### Build e deploy

```bash
bun run desktop:build    # Build desktop Linux (deb/rpm)
bun run deploy           # Deploy com bump de versão interativo
bun run desktop:update   # Atualiza do remoto e rebuilda
```

### Qualidade

```bash
bun run oxlint     # Lint
bun check          # Type check
bun test           # Testes
```

### CLI (para AI agents)

```bash
bun cli create-task '{"title": "...", "projectName": "Kowork", "categoryName": "feature", "priorityName": "Media"}'
bun cli read-task '{"taskId": "uuid"}'
bun cli update-task '{"taskId": "uuid", "status": "executed"}'
```

## Variáveis de ambiente

| Variável       | Obrigatória | Descrição                              | Default          |
| -------------- | ----------- | -------------------------------------- | ---------------- |
| `DATABASE_URL` | sim         | Caminho do arquivo SQLite              | `db.sqlite`      |
| `JWT_SECRET`   | sim         | Secret para assinatura de tokens JWT   | —                |
| `NODE_ENV`     | não         | `development` ou `production`          | `development`    |

## Conexão Front ↔ API

- O front usa ORPC em `/rpc` (HTTP) e `/ws` (WebSocket) na mesma origem
- Rotas do app (`/_app`) exigem sessão válida via `auth.me`
- Login padrão: `admin` / `password`
- Em produção/desktop sem servidor embarcado, o backend roda em `http://localhost:4178` ou via `window.__KOWORK_API_URL__`

## Documentação

- `docs/desktop/README.md` — Arquitetura e deploy desktop
- `docs/TERMINAL.md` — Integração de terminal (xterm.js + tmux)
- `AGENTS.md` — Knowledge base para AI coding agents
- `ROADMAP.md` — Roadmap de desenvolvimento

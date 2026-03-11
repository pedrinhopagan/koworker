# Koworker

ERP full-stack brasileiro focado em projetos e tarefas com AI Coding Agents.

## Stack

### Frontend

- **React 19**
- **TanStack Router** (file-based)
- **TanStack Query**
- **Zustand**
- **Tailwind 4**
- **Radix UI + shadcn**

### Backend

- **Bun**
- **ORPC** (HTTP + WebSocket)
- **Kysely**
- **SQLite** via `@lobomfz/db`

### Validação

- **Zod** (padrão)
- **Arktype** (schema do DB)

## Estrutura

```
src/
├── api/                 # ORPC, auth, schemas, db, pubsub
├── routes/              # TanStack Router (file-based)
├── components/          # UI (shadcn + base)
├── hooks/
├── lib/
├── stores/
├── types/
├── cli/                 # CLI Kowork
```

## WebSockets e PubSub

ORPC é usado para HTTP e WebSocket. Eventos em tempo real são publicados via PubSub e consumidos no front com `orpcWs`.

## Dev

```bash
bun install
bun dev
```

## Conexão Front ↔ API

- O front usa ORPC em `/rpc` (HTTP) e `/ws` (WebSocket) na mesma origem.
- Rotas do app (`/_app`) exigem sessão válida via `auth.me`.
- Em desktop/produção sem servidor embarcado, rode o backend em `http://localhost:4178` ou defina `window.__KOWORK_API_URL__` antes do bundle carregar.

## Login padrão

- Se não existir nenhum usuário, o backend cria automaticamente `admin` com senha `password`.

## Qualidade

```bash
bun run oxlint
bun check
bun test
```

## Desktop

Build desktop Linux:

```bash
bun run desktop:build
```

Deploy global (build da master + bump de versao interativo + atualizacao do app instalado):

```bash
bun run deploy
```

Atualizar do remoto (`origin/master` com fallback para `origin/main`) e rebuildar executavel:

```bash
bun run desktop:update
```

Documentacao completa em `docs/desktop/README.md`.

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

## Qualidade

```bash
bun run oxlint
bun check
bun test
```

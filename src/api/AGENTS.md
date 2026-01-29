# API AGENTS

## OBJETIVO

Padronizar ORPC, validação e regras de auth para o backend.

## REGRAS

- Router único em `src/api/router.ts` agregando subrouters
- Subrouters ficam em `src/api/routers/` (ex: `projects.ts`, `tasks.ts`)
- Schemas ficam em `src/api/schemas/` usando Zod
- Mensagens de erro sempre em pt-BR
- `publicProcedure` e `protectedProcedure` devem ser usados para auth
- Mutations de tasks publicam eventos via PubSub

## NOMENCLATURA

- `router.projects.create` / `router.tasks.update`
- `wsRouter.tasks.events` para streams em tempo real

## STATUS DE TASK

- `pending | in_execution | executed` (não criar estados extras na coluna)
- `completed_at` é separado do `status`

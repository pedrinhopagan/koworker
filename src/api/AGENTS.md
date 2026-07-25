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
- `wsRouter.tasks` para o stream de eventos de task; os demais streams são `notifications`, `flow`, `promptRun` e `terminal`

## STATUS DE TASK

- `tasks` não tem coluna `status`. A conclusão é `done` (0/1) mais `completed_at`.
- Execução vive em `execution_runs` (`kind`: `prompt | flow`; `status`: `running | done | failed | timeout | waiting_user | cancelled`).
- A etapa do fluxo é inferida dos artefatos da pasta da task (`inferTaskStage`), não persistida.

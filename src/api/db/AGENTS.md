# DB AGENTS

## OBJETIVO

Padronizar schema SQLite e queries Kysely.

## REGRAS

- Usar `@lobomfz/db` para definir schema e expor Kysely
- `connection.ts` é a fonte de verdade do schema. Toda coluna nova entra lá primeiro; o `AGENTS.md` raiz descreve o mesmo schema e precisa ser atualizado junto.
- IDs são `uuid` (TEXT) gerados na aplicação, exceto `users.id` (INTEGER autoincrement) e as tabelas com PK natural (`skill_settings.slug`, `agent_settings.slug`, `settings.key`)
- `snake_case` no DB, `camelCase` no TS (na camada `db` usar nomes das colunas)
- Datas em epoch ms (`number.integer`); booleanos em INTEGER 0/1
- `projects`, `tasks`, `execution_runs` e `agent_sessions` usam soft delete (`deleted_at`)
- JSON em coluna `TEXT`, sempre serialize/parse no boundary
- Inputs de `create/update` usam tipos inferidos dos schemas Zod da pasta `src/api/schemas/`

## TABLES

19, na ordem de registro em `connection.ts`:

- Domínio: `users`, `projects`, `categories`, `priorities`, `project_routes`, `task_groups`, `tasks`
- Storage: `task_storage_runs`
- Skills e agents: `skill_categories`, `skill_settings`, `skill_source_paths`, `agent_settings`, `agent_source_paths`
- Execução e histórico: `prompt_history`, `execution_runs`, `agent_sessions`, `agent_events`
- Infra: `push_subscriptions`, `settings`

Não existe `subtasks` nem `task_executions`. Subtarefa é arquivo `.md` na pasta da task; execução é `execution_runs`. Colunas por tabela: ver `AGENTS.md` na raiz.

## QUERIES

- Um arquivo por tabela dentro de `src/api/db/`
- Exportar um objeto com métodos (ex: `dbProjects.getAll`)
- `executeTakeFirst` para single, `execute` para listas
- Sempre filtrar `deleted_at IS NULL` quando aplicável

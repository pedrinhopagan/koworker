# DB AGENTS

## OBJETIVO

Padronizar schema SQLite e queries Kysely.

## REGRAS

- Usar `@lobomfz/db` para definir schema e expor Kysely
- IDs são `uuid` (TEXT) gerados na aplicação
- `snake_case` no DB, `camelCase` no TS
- `projects` e `tasks` usam soft delete (`deleted_at`)
- JSON em coluna `TEXT`, sempre serialize/parse no boundary

## TABLES

- `projects`, `project_routes`, `tasks`, `subtasks`, `categories`, `priorities`

## QUERIES

- Funções em módulos `Db*` dentro de `src/api/db/`
- `executeTakeFirst` para single, `execute` para listas
- Sempre filtrar `deleted_at IS NULL` quando aplicável

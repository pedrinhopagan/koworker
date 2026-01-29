# DB AGENTS

## OBJETIVO

Padronizar schema SQLite e queries Kysely.

## REGRAS

- Usar `@lobomfz/db` para definir schema e expor Kysely
- IDs são `uuid` (TEXT) gerados na aplicação
- `snake_case` no DB, `camelCase` no TS (na camada `db` usar nomes das colunas)
- `projects` e `tasks` usam soft delete (`deleted_at`)
- JSON em coluna `TEXT`, sempre serialize/parse no boundary
- Inputs de `create/update` usam tipos inferidos dos schemas Zod da pasta `src/api/schemas/`

## TABLES

- `projects`, `project_routes`, `tasks`, `subtasks`, `categories`, `priorities`

## QUERIES

- Um arquivo por tabela dentro de `src/api/db/`
- Exportar um objeto com métodos (ex: `dbProjects.getAll`)
- `executeTakeFirst` para single, `execute` para listas
- Sempre filtrar `deleted_at IS NULL` quando aplicável

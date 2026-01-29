# CLI AGENTS

## OBJETIVO

Atualizar tasks/subtasks diretamente no SQLite sem passar pela API.

## REGRAS

- CLI em `src/cli/` acessa o DB direto via Kysely
- Comando principal: `kowork update-task` recebendo JSON completo
- `completed_at` nunca é setado pela CLI
- Sempre atualizar `updated_at`
- Validar input com Zod
- Erros devem ser em pt-BR e retornar exit code != 0

## INPUT JSON (BASE)

- `taskId`
- `status` (`pending | in_execution | executed`)
- `notes?`
- `ai_metadata?`
- `acceptance_criteria?` (array de `{ id, text, done }`)
- `subtasks?` (lista com `id?`, `title`, `description?`, `status`)

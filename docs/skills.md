# Skills (defaults)

Este projeto possui **3 skills default** (hardcoded) que servem como *fonte da verdade* para prompts base e metadados.

- `manager` — planejamento (escopo, passos, riscos, critérios de aceite)
- `runner` — execução (implementação incremental + validação)
- `reviewer` — revisão (qualidade, riscos, testes)

## Onde fica o código

- `src/lib/skills/default-skills.ts`

Exports principais:
- `DEFAULT_SKILLS`
- `getDefaultSkill(id)`
- `hashPromptBase(promptBase)` (hash simples determinístico; ver implementação) + `promptBaseHash` por skill

## Seed no DB

Atualmente **não existe tabela/entidade de skills** no schema do DB (`src/api/db/connection.ts`).
Quando for criado suporte no banco, a recomendação é manter o arquivo acima como fonte da verdade e adicionar um seed **idempotente** que sincronize `id`, `version` e `promptBaseHash`.

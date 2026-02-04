# CLI AGENTS

## OBJETIVO

Atualizar tasks/subtasks diretamente no SQLite sem passar pela API. Usado por AI Coding Agents.

## ESTRUTURA

```
cli/
├── index.ts             # Entry point, parse de comandos
├── db.ts                # Conexão Kysely direta
└── commands/
    └── update-task.ts   # Comando principal
```

## REGRAS

- Acesso direto ao DB via Kysely
- Validar input com Zod
- Erros em pt-BR e exit code != 0
- Sempre atualizar `updated_at`
- Nunca setar `completed_at` (só o usuário aprova)

## COMANDOS

### create-task

Recebe JSON com campos opcionais:

```typescript
{
  title: string
  description?: string
  notes?: string
  status?: "pending" | "in_execution" | "executed"
  projectId?: string
  projectName?: string
  categoryId?: string
  categoryName?: string
  priorityId?: string
  priorityName?: string
  ai_metadata?: object
  acceptance_criteria?: Array<{ id: string, text: string, done: boolean }>
  subtasks?: Array<{
    title: string
    description?: string
    status?: "pending" | "in_execution" | "executed"
  }>
}
```

Notas:
- `projectId` ou `projectName` é obrigatório
- `categoryId` ou `categoryName` é obrigatório
- `priorityId` ou `priorityName` é obrigatório

### update-task

Recebe JSON com campos opcionais:

```typescript
{
  taskId: string          // obrigatório
  title?: string
  description?: string
  status?: "pending" | "in_execution" | "executed"
  notes?: string
  ai_metadata?: object
  acceptance_criteria?: Array<{ id: string, text: string, done: boolean }>
  subtasks?: Array<{
    id?: string           // se presente, atualiza; se ausente, cria
    title: string
    description?: string
    status?: "pending" | "in_execution" | "executed"
  }>
}
```

## USO

```bash
kowork create-task '{"title": "Auditoria Kowork", "projectName": "Kowork", "categoryName": "doc", "priorityName": "Media"}'
kowork update-task '{"taskId": "uuid", "status": "executed"}'
```

## ADICIONAR COMANDO

1. Criar `commands/meu-comando.ts` exportando função async
2. Registrar em `index.ts` no objeto `commands`
3. Documentar aqui

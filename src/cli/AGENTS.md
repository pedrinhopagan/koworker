# CLI AGENTS

## OBJETIVO

Ler e atualizar tasks/subtasks diretamente no SQLite sem passar pela API. Usado por AI Coding Agents.

## ESTRUTURA

```
cli/
├── index.ts             # Entry point, parse de comandos
├── db.ts                # Conexão Kysely direta
└── commands/
    ├── create-task.ts   # Criação de task/subtasks
    ├── read-task.ts     # Leitura completa de task (JSON output)
    ├── update-task.ts   # Atualização de task/subtasks
    └── schemas.ts       # Schemas/enums compartilhados
```

## REGRAS

- Acesso direto ao DB via Kysely
- Validar input com Zod
- Erros em pt-BR e exit code != 0
- Sempre atualizar `updated_at`
- Nunca setar `completed_at` para task ou subtask (só o usuário aprova)

## COMANDOS

### create-task

Recebe JSON com campos:

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
    displayOrder?: number
  }>
}
```

Notas:
- `projectId` ou `projectName` é obrigatório
- `categoryId` ou `categoryName` é obrigatório
- `priorityId` ou `priorityName` é obrigatório

### read-task

Recebe JSON com campos:

```typescript
{
  taskId: string          // obrigatório
}
```

Retorna JSON completo da task com projeto, categoria, prioridade, criterios de aceite e subtasks. Usado quando a IA precisa de dados completos do DB que nao foram enviados no prompt.

### update-task

Recebe JSON com campos:

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
    displayOrder?: number
  }>
}
```

Notas:
- `taskId` é obrigatório
- Atualização de subtask por `id` valida se a subtask existe
- Atualização de subtask por `id` valida se pertence à `taskId` informada
- Quando `id` é omitido em `subtasks`, uma nova subtask é criada

## USO

```bash
kowork create-task '{"title": "Auditoria Kowork", "projectName": "Kowork", "categoryName": "doc", "priorityName": "Media"}'
kowork read-task '{"taskId": "uuid"}'
kowork update-task '{"taskId": "uuid", "status": "executed"}'
```

## ADICIONAR COMANDO

1. Criar `commands/meu-comando.ts` exportando função async
2. Registrar em `index.ts` no objeto `commands`
3. Documentar aqui

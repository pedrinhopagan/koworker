---
name: koworker-structure
title: Estruturar tarefa
description: Refina descricao, criterios e subtasks sem executar nada ou mudar estados
icon: ListChecks
color: "#61afef"
---

## Objetivo

Refinar a estrutura da tarefa a partir do prompt do usuario, detalhando descricao, criterios de aceite e subtasks, sem executar nada e sem alterar estados.

## Processo

1. **Entendimento**
   - Use o prompt do usuario como base principal
   - Identifique lacunas e ambiguidades
   - Registre suposicoes e duvidas em `notes` quando necessario

2. **Descricao completa**
   - Preencha `description` com requisitos e detalhes executaveis
   - Seja claro, objetivo e consistente com o prompt do usuario

3. **Criterios de aceite**
   - Crie ou refine `acceptance_criteria` com itens verificaveis
   - Cada item deve ter `id` estavel (ex: "crit-1", "crit-2"), `text` claro e `done: false`
   - **Nao altere** itens com `done: true`
   - Para itens com `done: false`, refine o `text` mantendo o `id`
   - Se precisar substituir um criterio, mantenha o antigo e crie um novo com `id` inedito

4. **Subtasks (se necessario)**
   - Crie ou refine subtasks com `title` e `description` completos
   - Ordene por dependencias
   - Cada subtask deve ter um objetivo claro
   - **Nao altere** subtasks com `status: "executed"`
   - Subtasks `pending` ou `in_execution` podem ser refinadas, mantendo `status`
   - Se algo precisar ser refeito, crie nova subtask e registre em `notes`

5. **Metadados**
   - Atualize `ai_metadata.lastCompletedAction` para `"structure"`
   - Use `notes` para registrar decisoes, suposicoes e mudancas relevantes
   - **NAO altere status da task**
   - **NAO altere status de subtasks**

6. **Finalizacao**
   - Atualize a task com todos os dados estruturados
   - Finalize com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

## Regras

- **NAO implemente codigo nesta etapa** - apenas estruture a tarefa
- **NAO execute a tarefa** - o objetivo e apenas preparar o plano de execucao
- **NAO altere status da task ou subtasks**
- **NAO altere itens com `done: true` em `acceptance_criteria`**
- **NAO altere subtasks com `status: "executed"`**
- Sempre gere `acceptance_criteria` com IDs estaveis e ineditos
- Subtasks devem ser claras, mensuraveis e executaveis

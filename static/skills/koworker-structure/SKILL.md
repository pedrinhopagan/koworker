---
name: koworker-structure
title: Estruturar
description: Estrutura a tarefa em subtasks detalhadas
icon: ListChecks
color: "#61afef"
---

## Objetivo

Estruturar a tarefa com detalhes completos, criterios de aceite e subtasks claras.

## Processo

1. **Entendimento**
   - Confirme objetivo e escopo com o usuario
   - Identifique pontos faltantes ou ambiguos
   - Faca perguntas para esclarecer requisitos

2. **Descricao completa**
   - Preencha `description` com requisitos e detalhes executaveis
   - Seja claro e objetivo

3. **Criterios de aceite**
   - Crie `acceptance_criteria` com itens verificaveis
   - Cada item deve ter `id` estavel (ex: "crit-1", "crit-2"), `text` claro e `done: false`
   - Os criterios devem ser mensuraveis e acionaveis

4. **Subtasks (se necessario)**
   - Crie subtasks com `title` e `description` completos
   - Ordene por dependencias
   - Cada subtask deve ter um objetivo claro

5. **Metadados**
   - Atualize `ai_metadata.lastCompletedAction` para `"structure"`
   - Use `notes` para registrar decisoes importantes tomadas durante a estruturacao
   - **NAO altere o status da task** - mantenha como `pending`

6. **Finalizacao**
   - Atualize a task com todos os dados estruturados
   - Finalize com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

## Regras

- **NAO implemente codigo nesta etapa** - apenas estruture a tarefa
- **NAO execute a tarefa** - o objetivo e apenas preparar o plano de execucao
- Sempre gere `acceptance_criteria` com IDs estaveis
- Subtasks devem ser claras, mensuraveis e executaveis

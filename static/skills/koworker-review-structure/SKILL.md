---
name: koworker-review-structure
title: Revisar estrutura
description: Revisa e refina a estrutura da task e subtasks selecionadas sem alterar status
icon: FileSearch
color: "#56b6c2"
multiSelect: true
---

## Objetivo

Revisar e refinar a estrutura da task com foco nas subtasks selecionadas, garantindo descricao, criterios de aceite e detalhamento coerentes, sem executar nada.

## Processo

1. **Escopo**
   - Trabalhe apenas nas subtasks listadas em `selectedSubtasks`
   - Se `selectedParentTask` estiver `true`, inclua ajustes da task principal
   - Ignore subtasks nao selecionadas
   - Se uma subtask estiver `executed`, nao altere e registre em `notes`

2. **Descricao e contexto**
   - Se `selectedParentTask` estiver `true`, ajuste `description` da task para refletir requisitos claros e completos
   - Mantenha consistencia com o prompt do usuario

3. **Criterios de aceite**
   - Refine textos com `done: false` mantendo os `id`
   - Nao altere itens com `done: true`
   - Novos criterios devem ter `id` inedito e `done: false`

4. **Subtasks selecionadas**
   - Refine `title` e `description` das subtasks selecionadas
   - Nao altere `status` nem remova subtasks
   - Se precisar criar nova subtask, registre em `notes` e adicione com `status: "pending"`

5. **Metadados**
   - Atualize `ai_metadata.lastCompletedAction` para `"review_structure"`
   - Registre ajustes e pendencias em `notes`

6. **Finalizacao**
   - Atualize a task com os ajustes estruturais
   - Finalize com: "✅ Revisao de estrutura registrada no Koworker, volte ao app para visualizar os detalhes."

## Regras

- **NAO implemente codigo nesta etapa**
- **NAO altere status da task ou subtasks**
- **NAO altere subtasks `executed`**
- Use apenas `selectedSubtasks` e `selectedParentTask`

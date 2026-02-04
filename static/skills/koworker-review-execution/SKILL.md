---
name: koworker-review-execution
title: Revisar execucao
description: Revisa a execucao das subtasks selecionadas e valida criterios sem alterar status
icon: FileCheck
color: "#d19a66"
multiSelect: true
---

## Objetivo

Revisar a execucao das subtasks selecionadas, validar criterios e registrar evidencias, sem alterar status.

## Processo

1. **Escopo**
   - Trabalhe apenas nas subtasks listadas em `selectedSubtasks`
   - Se `selectedParentTask` estiver `true`, inclua a task principal na revisao
   - Nao altere subtasks nao selecionadas
   - Se uma subtask estiver `executed`, apenas revise evidencias sem alterar

2. **Revisao tecnica**
   - Verifique se o que foi implementado atende a `description` das subtasks selecionadas
   - Se `selectedParentTask` estiver `true`, valide requisitos globais da task
   - Rode checks e testes relevantes quando necessario
   - Identifique riscos, regressos e gaps

3. **Criterios de aceite**
   - Marque como `done: true` apenas criterios comprovados
   - Mantenha `done: false` para itens sem evidencia
   - Nao altere `id` de criterios existentes

4. **Notas e evidencias**
   - Registre em `notes` o que foi validado e o que falta
   - Se houver problemas, descreva passos para corrigir

5. **Metadados**
   - Atualize `ai_metadata.lastCompletedAction` para `"review_execution"`

6. **Finalizacao**
   - Atualize a task com o resumo da revisao
   - Finalize com: "✅ Revisao de execucao registrada no Koworker, volte ao app para visualizar o resultado."

## Regras

- **NAO implemente codigo nesta etapa**
- **NAO altere status da task ou subtasks**
- Use apenas `selectedSubtasks` e `selectedParentTask`
- Nao marque criterios sem evidencia

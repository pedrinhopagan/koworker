---
name: Executar Subtask(s)
description: Executa apenas as subtasks selecionadas
icon: CirclePlay
color: "#e5c07b"
requiresSubtaskSelection: true
---

## Objetivo

Executar apenas as subtasks selecionadas pelo usuario.

## Processo

1. **Inicio**
   - Se a task ainda estiver `pending`, marque como `status: "in_execution"`
   - Trabalhe apenas nas subtasks listadas em `selectedSubtasks`
   - Respeite a ordem exibida

2. **Execucao por subtask**
   - Para cada subtask selecionada:
      - Marque a subtask como `status: "in_execution"`
      - Implemente seguindo a `description` da subtask
      - Marque a subtask como `status: "executed"`
      - Mantenha `title` e `description` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize `acceptance_criteria` conforme necessario
   - Marque apenas os criterios relacionados as subtasks executadas

4. **Finalizacao**
   - Atualize `notes` com resumo das subtasks executadas
   - **NAO marque a task principal como executed** - apenas as subtasks selecionadas
   - Atualize a task com o resumo das subtasks executadas
   - Finalize com: "✅ Subtask(s) selecionada(s) executada(s) no Koworker, volte ao app para revisar."

## Regras

- **Nao altere subtasks nao selecionadas** - mantenha escopo estrito
- Apenas trabalhe nas subtasks listadas em `selectedSubtasks`

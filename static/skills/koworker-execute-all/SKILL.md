---
name: koworker-execute-all
title: Executar pendentes
description: Executa todas as subtasks pendentes de tarefas simples em uma unica rodada
icon: Rocket
color: "#98c379"
---

## Objetivo

Executar todas as subtasks pendentes de uma tarefa de baixa complexidade em uma unica rodada, sem perder contexto.

## Processo

1. **Validacao de escopo**
   - Confirme que a tarefa e de baixa complexidade
   - Confirme que o contexto cabe em uma unica rodada de execucao
   - Se nao atender, nao use esta skill

2. **Inicio**
   - Se a task estiver `pending`, atualize para `status: "in_execution"`
   - Se a task ja estiver `in_execution`, mantenha o status

3. **Execucao por subtask**
   - Para cada subtask `pending` (na ordem):
       - Marque a subtask como `status: "in_execution"`
       - Implemente seguindo a `description` da subtask
       - Marque a subtask como `status: "executed"`
       - Mantenha `title` e `description` originais ao atualizar a subtask
   - Se houver subtask `in_execution`, finalize antes de seguir

4. **Criterios de aceite**
   - Atualize `acceptance_criteria` conforme os itens forem atendidos
   - Marque cada criterio como `done: true` quando completado
   - Nao marque criterio sem evidencias de conclusao

5. **Finalizacao**
   - Atualize `notes` com resumo completo do que foi implementado
   - Marque a task como `status: "executed"` apenas se todas as subtasks estiverem `executed`
   - Finalize com: "✅ Subtasks pendentes executadas no Koworker, volte ao app para revisar."

## Regras

- Use apenas para tarefas de baixa complexidade
- Uma subtask por vez, na ordem correta
- Nao altere subtasks com `status: "executed"`
- Nao crie ou refatore subtasks nesta etapa
- Nao pule validacoes importantes
- Se houver bloqueio, registre em `notes` e mantenha a task `in_execution`

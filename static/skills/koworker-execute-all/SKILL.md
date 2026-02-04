---
name: Executar Tudo
description: Executa todas as subtasks pendentes
icon: Rocket
color: "#98c379"
---

## Objetivo

Executar todas as subtasks pendentes da tarefa em sequencia.

## Processo

1. **Inicio**
   - Atualize a task para `status: "in_execution"`

2. **Execucao por subtask**
   - Para cada subtask pendente (na ordem):
      - Marque a subtask como `status: "in_execution"`
      - Implemente seguindo a `description` da subtask
      - Marque a subtask como `status: "executed"`
      - Mantenha `title` e `description` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize `acceptance_criteria` conforme os itens forem atendidos
   - Marque cada criterio como `done: true` quando completado

4. **Finalizacao**
   - Atualize `notes` com resumo completo do que foi implementado
   - Marque a task como `status: "executed"`
   - Finalize com: "✅ Todas as subtasks foram executadas no Koworker, volte ao app para revisar."

## Regras

- Uma subtask por vez, na ordem correta
- Nao pule validacoes importantes
- Se houver bloqueio, registre em `notes` e atualize a task

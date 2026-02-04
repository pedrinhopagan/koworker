---
name: koworker-commit
title: Commit
description: Cria um commit das alteracoes
icon: GitCommitHorizontal
color: "#56b6c2"
---

## Objetivo

Criar um commit git com as alteracoes feitas nesta tarefa.

## Processo

1. **Analise**
   - Execute `git status` para ver arquivos modificados
   - Execute `git diff` para revisar as mudancas
   - Selecione apenas arquivos relacionados a esta tarefa

2. **Mensagem**
   - Use Conventional Commits (feat, fix, refactor, docs, etc.)
   - Descricao concisa em portugues
   - Referencie a tarefa se aplicavel

3. **Commit**
   - Execute `git add` nos arquivos selecionados
   - Execute `git commit -m "mensagem"`
   - Capture o hash do commit

4. **Finalizacao**
   - Atualize `notes` com: hash do commit, mensagem e lista de arquivos commitados
   - Se **todas as subtasks estiverem executed** e **todos os acceptance_criteria com done:true**:
     - Marque a task como `status: "executed"` (se ainda nao estiver)
     - Informe ao usuario: "Tarefa pronta para aprovacao - usuario deve marcar como concluida no app"
   - Atualize a task com o resultado do commit
   - Finalize com: "✅ Commit criado e registrado no Koworker, volte ao app para continuar."

## Regras

- **Nunca commitar arquivos sensiveis** (.env, credentials, tokens, etc.)
- Nao alterar `ai_metadata.lastCompletedAction` (manter valor atual)
- **NAO defina completed_at** - isso e feito apenas pelo usuario ao aprovar no app

---
name: koworker-commit
title: Criar commit
description: Cria um commit com as alteracoes da tarefa
icon: GitCommitHorizontal
color: "#56b6c2"
---

## Objetivo

Criar um commit git apenas com as alteracoes desta tarefa.

## Processo

1. **Analise**
   - Execute `git status`, `git diff` e `git log -5 --oneline`
   - Se nao houver mudancas, registre em `notes` e finalize sem commit
   - Selecione apenas arquivos relacionados a esta tarefa

2. **Mensagem**
   - Siga o padrao do historico recente
   - Descricao concisa em pt-BR
   - Foque no motivo da mudanca

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
- **Nao usar** `git commit --amend`
- **Nao fazer** `git push`
- Nao alterar `ai_metadata.lastCompletedAction` (manter valor atual)
- **NAO defina completed_at** - isso e feito apenas pelo usuario ao aprovar no app

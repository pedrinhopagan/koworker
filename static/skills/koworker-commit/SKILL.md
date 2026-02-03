---
name: Commit
description: Cria um commit das alteracoes
icon: GitCommitHorizontal
color: "#56b6c2"
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Analise as alteracoes** com git status e git diff
3. **Crie o commit git** seguindo Conventional Commits
4. **Atualize a tarefa via CLI** usando o comando `kowork update-task` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Commit criado e registrado no Koworker, volte ao app para continuar."

## Ferramentas Disponiveis

Voce tem acesso a ferramenta **Bash** para executar comandos no terminal.

Use-a para executar o comando CLI do Koworker:

```bash
kowork update-task '<JSON>'
```

**IMPORTANTE:**
- Sempre use a ferramenta Bash, NUNCA apenas sugira o comando
- Execute o comando diretamente usando Bash tool
- Verifique o output do comando (deve mostrar mensagem de sucesso)
- Se houver erro, corrija e tente novamente
- NAO prossiga sem confirmar que o comando foi executado com sucesso

## Base da Task (Koworker)

- `description` e a fonte principal dos requisitos e detalhes
- `acceptance_criteria` e uma lista JSON: `[{ id, text, done }]`
- Use `notes` para registrar observacoes relevantes da IA
- Subtasks devem ter `title` e `description` completos
- Ao atualizar `acceptance_criteria`, envie o array completo
- Status valido: `pending` | `in_execution` | `executed`

## Objetivo

Criar um commit git com as alteracoes feitas nesta tarefa.

## Processo

1. **Analise**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
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
   - Atualize `notes` via CLI com: hash do commit, mensagem e lista de arquivos commitados
   - Se **todas as subtasks estiverem executed** e **todos os acceptance_criteria com done:true**:
     - Marque a task como `status: "executed"` (se ainda nao estiver)
     - Informe ao usuario: "Tarefa pronta para aprovacao - usuario deve marcar como concluida no app"
   - Execute o comando `kowork update-task` (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Commit criado e registrado no Koworker, volte ao app para continuar."

## Regras

- **Nunca commitar arquivos sensiveis** (.env, credentials, tokens, etc.)
- Nao alterar `ai_metadata.lastCompletedAction` (manter valor atual)
- **NAO defina completed_at** - isso e feito apenas pelo usuario ao aprovar no app
- Use a CLI `kowork update-task` para registrar o commit
- Verifique o sucesso do comando CLI antes de finalizar

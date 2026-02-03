---
name: Executar Subtask(s)
description: Executa apenas as subtasks selecionadas
icon: CirclePlay
color: "#e5c07b"
requiresSubtaskSelection: true
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Execute apenas as subtasks selecionadas** pelo usuario
3. **Atualize a tarefa via CLI** usando o comando `kowork update-task` apos cada subtask (documentado abaixo)
4. **Verifique o sucesso** da execucao do comando antes de finalizar
5. **Finalize** com: "✅ Subtask(s) selecionada(s) executada(s) no Koworker, volte ao app para revisar."

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

Executar apenas as subtasks selecionadas pelo usuario.

## Processo

1. **Inicio**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Se a task ainda estiver `pending`, marque como `status: "in_execution"` via CLI
   - Trabalhe apenas nas subtasks listadas em `selectedSubtasks`
   - Respeite a ordem exibida

2. **Execucao por subtask**
   - Para cada subtask selecionada:
     - Marque a subtask como `status: "in_execution"` via CLI `kowork update-task`
     - Implemente seguindo a `description` da subtask
     - Marque a subtask como `status: "executed"` via CLI `kowork update-task`
     - Mantenha `title` e `description` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize `acceptance_criteria` via CLI conforme necessario
   - Marque apenas os criterios relacionados as subtasks executadas
   - Envie o array completo de acceptance_criteria

4. **Finalizacao**
   - Atualize `notes` com resumo das subtasks executadas
   - **NAO marque a task principal como executed** - apenas as subtasks selecionadas
   - Execute o comando `kowork update-task` final (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Subtask(s) selecionada(s) executada(s) no Koworker, volte ao app para revisar."

## Regras

- **Nao altere subtasks nao selecionadas** - mantenha escopo estrito
- Apenas trabalhe nas subtasks listadas em `selectedSubtasks`
- Use a CLI `kowork update-task` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar

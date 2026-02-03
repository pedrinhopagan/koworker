---
name: Executar Tudo
description: Executa todas as subtasks pendentes
icon: Rocket
color: "#98c379"
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Execute todas as subtasks** pendentes em sequencia
3. **Atualize a tarefa via CLI** usando o comando `kowork update-task` apos cada subtask (documentado abaixo)
4. **Verifique o sucesso** da execucao do comando antes de finalizar
5. **Finalize** com: "✅ Todas as subtasks foram executadas no Koworker, volte ao app para revisar."

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

Executar todas as subtasks pendentes da tarefa em sequencia.

## Processo

1. **Inicio**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Atualize a task para `status: "in_execution"` via CLI `kowork update-task`

2. **Execucao por subtask**
   - Para cada subtask pendente (na ordem):
     - Marque a subtask como `status: "in_execution"` via CLI `kowork update-task`
     - Implemente seguindo a `description` da subtask
     - Marque a subtask como `status: "executed"` via CLI `kowork update-task`
     - Mantenha `title` e `description` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize `acceptance_criteria` via CLI conforme os itens forem atendidos
   - Marque cada criterio como `done: true` quando completado
   - Envie o array completo de acceptance_criteria

4. **Finalizacao**
   - Atualize `notes` com resumo completo do que foi implementado
   - Marque a task como `status: "executed"`
   - Execute o comando `kowork update-task` final (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Todas as subtasks foram executadas no Koworker, volte ao app para revisar."

## Regras

- Uma subtask por vez, na ordem correta
- Nao pule validacoes importantes
- Se houver bloqueio, registre em `notes` e atualize via CLI
- Use a CLI `kowork update-task` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar

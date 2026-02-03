---
name: Estruturar
description: Estrutura a tarefa em subtasks detalhadas
icon: ListChecks
color: "#61afef"
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Faca perguntas** ao usuario para esclarecer objetivo e escopo
3. **Estruture a tarefa** com description, acceptance_criteria e subtasks
4. **Atualize a tarefa via CLI** usando o comando `kowork update-task` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

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

Estruturar a tarefa com detalhes completos, criterios de aceite e subtasks claras.

## Processo

1. **Entendimento**
   - Leia atentamente as "Instrucoes do Usuario" no inicio do prompt
   - Confirme objetivo e escopo com o usuario
   - Identifique pontos faltantes ou ambiguos
   - Faca perguntas para esclarecer requisitos

2. **Descricao completa**
   - Preencha `description` com requisitos e detalhes executaveis
   - Seja claro e objetivo

3. **Criterios de aceite**
   - Crie `acceptance_criteria` com itens verificaveis
   - Cada item deve ter `id` estavel (ex: "crit-1", "crit-2"), `text` claro e `done: false`
   - Os criterios devem ser mensuraveis e acionaveis

4. **Subtasks (se necessario)**
   - Crie subtasks com `title` e `description` completos
   - Ordene por dependencias
   - Cada subtask deve ter um objetivo claro

5. **Metadados**
   - Atualize `ai_metadata.lastCompletedAction` para `"structure"`
   - Use `notes` para registrar decisoes importantes tomadas durante a estruturacao
   - **NAO altere o status da task** - mantenha como `pending`

6. **Finalizacao**
   - Execute o comando `kowork update-task` com todos os dados estruturados (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

## Regras

- **NAO implemente codigo nesta etapa** - apenas estruture a tarefa
- **NAO execute a tarefa** - o objetivo e apenas preparar o plano de execucao
- Sempre gere `acceptance_criteria` com IDs estaveis
- Subtasks devem ser claras, mensuraveis e executaveis
- Use a CLI `kowork update-task` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar

---
name: Revisar Plano
description: Revisa a tarefa e faz perguntas
icon: FileSearch
color: "#c678dd"
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Revise a tarefa** validando description, acceptance_criteria e subtasks
3. **Execute verificacoes tecnicas** se existirem (testes, checks, etc.)
4. **Atualize a tarefa via CLI** usando o comando `kowork update-task` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Revisao concluida no Koworker, volte ao app para visualizar o resultado."

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

Revisar a tarefa, criterios de aceite e subtasks antes do commit.

## Processo

1. **Validacao**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Verifique se `description` cobre todo o escopo da tarefa
   - Revise `acceptance_criteria` item a item
   - Confira se subtasks estao coerentes e bem definidas
   - Identifique gaps, inconsistencias ou pontos faltantes

2. **Verificacoes tecnicas**
   - Rode checks e testes relevantes (se existirem)
   - Verifique se o codigo implementado atende os requisitos
   - Valide integracao e qualidade

3. **Resumo**
   - Atualize `notes` via CLI com resultado detalhado da revisao
   - Liste problemas encontrados e recomendacoes
   - Se aprovado, setar `ai_metadata.lastCompletedAction` como `"review"`

4. **Finalizacao**
   - Execute o comando `kowork update-task` com os resultados da revisao (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Revisao concluida no Koworker, volte ao app para visualizar o resultado."

## Regras

- **NAO implemente codigo nesta etapa** - apenas revise o que foi feito
- Seja objetivo e acionavel nos feedbacks
- Use a CLI `kowork update-task` para persistir os resultados da revisao
- Verifique o sucesso do comando CLI antes de finalizar

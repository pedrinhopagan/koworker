---
name: Quick Fix
description: Aplica um ajuste rapido e pontual
icon: Wrench
color: "#e06c75"
---

## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Identifique o ajuste** necessario exatamente como descrito
3. **Execute a mudanca** de forma pontual e minima
4. **Atualize a tarefa via CLI** usando o comando `kowork update-task` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Ajuste aplicado e registrado no Koworker, volte ao app para validar."

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

Aplicar um ajuste rapido e pontual conforme descrito pelo usuario.

## Processo

1. **Entendimento**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Identifique exatamente o que precisa ser ajustado
   - Confirme o escopo se houver ambiguidade

2. **Execucao**
   - Faca apenas a mudanca solicitada
   - Evite refatoracoes ou melhorias nao solicitadas
   - Mantenha o escopo minimo

3. **Atualizacao**
   - Registre o que foi feito em `notes` via CLI
   - Atualize `acceptance_criteria` se o ajuste afetar algum item
   - Envie o array completo de acceptance_criteria
   - **NAO altere status da task ou subtasks** - Quick Fix nao muda estados de execucao

4. **Finalizacao**
   - Execute o comando `kowork update-task` com o registro do ajuste (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Ajuste aplicado e registrado no Koworker, volte ao app para validar."

## Regras

- **Escopo minimo** - faca apenas o que foi solicitado
- Clareza nas notas - descreva exatamente o que foi alterado
- Evite refatoracoes ou "melhorias" nao pedidas
- Use a CLI `kowork update-task` para registrar o ajuste
- Verifique o sucesso do comando CLI antes de finalizar

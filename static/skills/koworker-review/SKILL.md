---
name: koworker-review
title: Revisar Plano
description: Revisa a tarefa e faz perguntas
icon: FileSearch
color: "#c678dd"
---

## Objetivo

Revisar a tarefa, criterios de aceite e subtasks antes do commit.

## Processo

1. **Validacao**
   - Verifique se `description` cobre todo o escopo da tarefa
   - Revise `acceptance_criteria` item a item
   - Confira se subtasks estao coerentes e bem definidas
   - Identifique gaps, inconsistencias ou pontos faltantes

2. **Verificacoes tecnicas**
   - Rode checks e testes relevantes (se existirem)
   - Verifique se o codigo implementado atende os requisitos
   - Valide integracao e qualidade

3. **Resumo**
   - Atualize `notes` com resultado detalhado da revisao
   - Liste problemas encontrados e recomendacoes
   - Se aprovado, setar `ai_metadata.lastCompletedAction` como `"review"`

4. **Finalizacao**
   - Atualize a task com os resultados da revisao
   - Finalize com: "✅ Revisao concluida no Koworker, volte ao app para visualizar o resultado."

## Regras

- **NAO implemente codigo nesta etapa** - apenas revise o que foi feito
- Seja objetivo e acionavel nos feedbacks

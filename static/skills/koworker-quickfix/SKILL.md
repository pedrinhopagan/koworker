---
name: koworker-quickfix
title: Quick Fix
description: Aplica um ajuste rapido e pontual
icon: Wrench
color: "#e06c75"
---

## Objetivo

Aplicar um ajuste rapido e pontual conforme descrito pelo usuario.

## Processo

1. **Entendimento**
   - Identifique exatamente o que precisa ser ajustado
   - Confirme o escopo se houver ambiguidade

2. **Execucao**
   - Faca apenas a mudanca solicitada
   - Evite refatoracoes ou melhorias nao solicitadas
   - Mantenha o escopo minimo

3. **Atualizacao**
   - Registre o que foi feito em `notes`
   - Atualize `acceptance_criteria` se o ajuste afetar algum item
   - **NAO altere status da task ou subtasks** - Quick Fix nao muda estados de execucao

4. **Finalizacao**
   - Atualize a task com o registro do ajuste
   - Finalize com: "✅ Ajuste aplicado e registrado no Koworker, volte ao app para validar."

## Regras

- **Escopo minimo** - faca apenas o que foi solicitado
- Clareza nas notas - descreva exatamente o que foi alterado
- Evite refatoracoes ou "melhorias" nao pedidas

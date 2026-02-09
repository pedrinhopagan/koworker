---
name: koworker-structure
description: Use when a task must be structured before execution and scope is unclear, requirements are missing, risks or dependencies exist, or acceptance criteria/subtasks must be defined
title: Estruturar
icon: ListChecks
color: "#61afef"
---

# Koworker Structuring

## Overview

Turn a request into a concise, validated plan without assumptions.

**Stop condition:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, respond only with the gate response below. Do not add anything else or rephrase it.

## Principles

- Read `AGENTS.md` or `CLAUDE.md` before any question.
- Do not ask requirement questions or structure anything before those files are read.
- Communicate with the user in pt-BR.
- Never assume missing information.
- Ask one question per message.
- Do not suggest defaults or baselines.
- Do not proceed until critical gaps are answered.
- If the user asks to skip questions, you still must follow the gate and ask for the files.

## Koworker CLI (required)

**Escrita:** `kowork update-task '<JSON>'` — para atualizar status, notes, criterios, subtasks.
**Leitura:** `kowork read-task '{"taskId":"<ID>"}'` — retorna JSON completo do DB. Use APENAS se os dados do prompt forem insuficientes.

- Confirm command success in output; if it fails, fix and run again.
- Use `description` as the main source of requirements.
- Keep `notes` updated with decisions, assumptions, and open items.
- When updating `acceptance_criteria`, send the full array `[{ id, text, done }]`.
- Valid status values: `pending`, `in_execution`, `executed`.
- For subtask updates, keep `title`/`description`; for new subtasks, omit `id` and use sequential `displayOrder`.
- Never set `completed_at`.

## Process

1. **Preparation**
   - Locate the project and read `AGENTS.md` or `CLAUDE.md` (root and relevant subfolder).
   - If you cannot read files, ask the user to paste the content and stop.
   - If tool access is restricted, do not ask for permission; ask for the file content instead.
   - Do not claim a file is missing unless you actually searched with tools.
   - Anything not covered by those files must be asked.

   **Hard gate:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, your only allowed response is to request the file content or path. Do not ask any other questions.

   **Gate response (use this exact text):**
   "Por favor, cole `AGENTS.md` ou `CLAUDE.md` para eu continuar. Nao posso fazer outras perguntas antes de ler esse arquivo."

2. **Mandatory questions**
   - Ask until gaps are closed, covering:
     - Problem and real impact
     - End goal / expected outcome
     - Scope (in and out)
     - Rules and constraints (business and technical)
     - Expected behavior and edge cases
     - Dependencies (data, systems, teams)
     - Validation (how to prove done)
   - One question per message. No defaults.

3. **Task map (consolidate)**
   - Problem
   - Impact
   - Objective
   - Scope (in/out)
   - Rules/constraints
   - Dependencies
   - Risks/mitigations
   - Validation
   - Affected areas

4. **Concise plan**
   - `description`: clear summary of objective + task map
   - `acceptance_criteria`: verifiable items with stable `id` and `done: false`
   - Create subtasks only for real dependencies, distinct layers, or technical risk
   - Order subtasks by dependency

5. **Metadata and CLI**
   - Use the CLI defined in `AGENTS.md` or `CLAUDE.md`
   - Update `description`, `acceptance_criteria`, `notes`, and `ai_metadata.lastCompletedAction = "structure"`
   - Do not change task status (keep `pending`)

6. **Finalization**
   - "✅ Tarefa estruturada no Koworker, volte ao app para ver os detalhes."

## Quick reference

- Read `AGENTS.md`/`CLAUDE.md` before any question.
- No assumptions. No defaults. One question per message.
- Build a task map, then derive criteria and subtasks.
- Update via CLI and keep status `pending`.

## Rules

- Do not implement code.
- Do not execute the task.
- Do not create description, criteria, or subtasks before reading `AGENTS.md` or `CLAUDE.md`.
- If those files are not read or pasted, do not ask requirement questions.
- If those files are not read or pasted, do not proceed with structure.
- Do not change task or subtask status.
- Do not edit `acceptance_criteria` items with `done: true`.
- If replacing a criterion, keep the old item and add a new `id`.
- Do not edit subtasks with `status: "executed"`.
- `pending`/`in_execution` subtasks can be refined while preserving status.
- If something must be redone, create a new subtask and record it in `notes`.
- Do not claim to have read files you did not read.
- Do not claim a file is missing without tool verification.
- All user-facing messages must be in pt-BR.

## Common mistakes

- Writing criteria before confirming the goal.
- Assuming scope or defaults to go faster.
- Asking multiple questions at once.
- Proceeding without `AGENTS.md`/`CLAUDE.md`.
- Asking any requirement question before the files are read.
- Asking for permission to use tools instead of requesting the file content.
- Responding in English.

## Red flags

- "I will assume the project"
- "Defaulting to..."
- "I can proceed without reading AGENTS/CLAUDE"
- "I could not find AGENTS/CLAUDE"
- "I can proceed with the context I have"
- "I searched the workspace" (without tool access)
- "Can I use tools to read the file?"
- "I will not ask questions"

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "User said not to ask" | You must ask; structure is invalid without answers. |
| "I will assume and adjust later" | Never assume; ask before structuring. |
| "I can skip AGENTS/CLAUDE" | Read first or ask the user to paste it. |
| "I did not find AGENTS/CLAUDE" | Only say this after tool search; otherwise ask for the path or paste. |
| "Tool access is restricted, so I will proceed" | Stop and ask for the file content; no other questions allowed. |
| "I need permission to read the file" | Do not ask permission; request the file content instead. |

## Example

Request: "Add status filter to the task list"

Task map (summary):
- Problem: list cannot be filtered by status
- Objective: allow filtering by status on the task list view
- Scope: only main list view, no reports

Acceptance criteria format:
```json
[
  { "id": "crit-1", "text": "Status filter is visible on the task list", "done": false },
  { "id": "crit-2", "text": "Selecting a status filters the list immediately", "done": false },
  { "id": "crit-3", "text": "Filter state persists when navigating away and back", "done": false }
]
```

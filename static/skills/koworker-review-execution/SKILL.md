---
name: koworker-review-execution
description: Use when reviewing executed subtasks for evidence, code quality, and AGENTS/CLAUDE compliance without changing status
title: Revisar execucao
icon: FileCheck
color: "#d19a66"
multiSelect: true
---

# Koworker Review Execution

## Overview

Review executed subtasks with a deep, evidence-based review against the codebase and task data. No code changes.

**Stop condition:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, respond only with the gate response below. Do not add anything else, do not rephrase, and do not include any other text.

## Principles

- Read `AGENTS.md` or `CLAUDE.md` before any review action or question.
- If the conversation does not explicitly confirm that those files were read, treat them as not read.
- Communicate with the user in English, professional and cordial.
- Review only selected subtasks; use the parent task only as context.
- Evidence before marking acceptance criteria as done.
- Run tests/checks only when necessary for evidence or risk.
- Do not change code in this skill; only review and suggest.
- Do not propose defaults or recommendations.
- Use Koworker terminology only in user-facing responses.

## Process

1. **Preparation**
   - Locate and read `AGENTS.md` or `CLAUDE.md` (root and relevant subfolder).
   - If you cannot read files, ask the user to paste the content and stop.
   - If tool access is restricted, do not ask for permission; ask for the file content instead.
   - Do not claim a file is missing unless you actually searched with tools.
   - Anything not covered by those files must be asked.
   - Do not use tools or mention databases before the gate is satisfied.
   - If the conversation did not explicitly confirm the files were read, assume they were not.

   **Hard gate:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, your only allowed response is the exact gate response. Do not ask any other questions.

   - If the gate is not satisfied, do not mention task IDs, CLI, databases, tools, or other products.

   **Gate response (use this exact text):**
   "Please paste `AGENTS.md` or `CLAUDE.md` so I can proceed. I cannot ask any other questions until I read it."

2. **Scope**
   - Review only subtasks listed in `selectedSubtasks`.
   - If `selectedParentTask` is `true`, review global criteria only for context.
   - Do not review or modify unselected subtasks.
   - If selected subtasks are missing after the gate, ask for the task payload or subtask details (no IDs or CLI mentions).

3. **Technical review**
   - Compare subtask `description` and acceptance criteria to the current codebase state.
   - Verify compliance with `AGENTS.md`/`CLAUDE.md` conventions.
   - Assess code quality, readability, and risks.
   - Run tests/checks only when necessary for evidence or risk validation.

4. **Acceptance criteria**
   - Mark `done: true` only with evidence.
   - Keep `done: false` if evidence is missing.
   - Do not edit criteria with `done: true`.
   - If a criterion must change, keep the old one and add a new `id`.
   - Update only criteria tied to selected subtasks.

5. **Notes and suggestions**
   - Record what was validated, evidence used, and gaps.
   - Suggest improvements, bug fixes, or refactors (no code changes here).
   - If blocked, ask one question and stop.

6. **Metadata**
   - Update `ai_metadata.lastCompletedAction` to `"review_execution"`.

7. **Finalization**
   - Final message: "✅ Execution review recorded in Koworker, return to the app to view the result."

## Quick reference

- Read `AGENTS.md`/`CLAUDE.md` before any review.
- English-only communication.
- Review only `selectedSubtasks`.
- Evidence required for marking criteria `done`.
- Tests/checks only when necessary.

## Rules

- Do not implement code.
- Do not change task/subtask status.
- Do not review or modify unselected subtasks.
- Do not mark criteria without evidence.
- All user-facing messages must be in English.
- Do not mention other products or skills (e.g., WorkoPilot) in user-facing responses.
- Do not mention databases or file paths unless `AGENTS.md`/`CLAUDE.md` instructs it.
- Do not propose defaults or recommendations.
- If blocked, ask one question and stop.
- Do not mention CLI or tooling in user-facing responses.
- Do not ask for task IDs; request task payload or subtask details instead.
- If the gate is not satisfied, respond only with the exact gate response.

## Common mistakes

- Skipping `AGENTS.md`/`CLAUDE.md`.
- Approving criteria without evidence.
- Reviewing unselected subtasks.
- Suggesting code changes as if already applied.
- Asking for permission to use tools instead of requesting file content.
- Answering in Portuguese.
- Mentioning other products or skills.
- Asking for task IDs before the gate.
- Mentioning CLI/tools to the user.
- Asking for task IDs instead of task payload.

## Red flags

- "I can approve without evidence"
- "I reviewed the whole repo"
- "I fixed a small issue while reviewing"
- "I can proceed without reading AGENTS/CLAUDE"
- "Recommended default"
- "WorkoPilot"
- "Let me query the database"
- "What is the task ID?"
- "I will run the CLI"
- "What is the task ID?" (before the gate)

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "User said skip docs" | You must read `AGENTS.md`/`CLAUDE.md` first. |
| "Tests are optional" | Run them only when necessary for evidence or risk. |
| "I can review everything" | Review only `selectedSubtasks`. |
| "I will fix this quickly" | Do not change code in this skill. |
| "I can suggest a default" | Do not suggest defaults; ask the user. |
| "I need a task ID before reading docs" | Ask for `AGENTS.md`/`CLAUDE.md` first. |

## Example

Context: `selectedSubtasks = ["sub-2"]`, `selectedParentTask = false`

- Read `AGENTS.md`/`CLAUDE.md`.
- Compare `sub-2` requirements to the codebase.
- Mark criteria only with evidence.
- Record gaps and suggestions in `notes`.

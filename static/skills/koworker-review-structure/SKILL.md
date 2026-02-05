---
name: koworker-review-structure
description: Use when reviewing task structure and selected subtasks to strengthen the plan without touching code or status
title: Revisar estrutura
icon: FileSearch
color: "#56b6c2"
multiSelect: true
---

# Koworker Review Structure

## Overview

Review task structure with focus on selected subtasks, strengthening the plan only. No code changes.

**Stop condition:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, respond only with the gate response below. Do not add anything else, do not rephrase, and do not include any other text.

## Principles

- Read `AGENTS.md` or `CLAUDE.md` before any review action or question.
- If the conversation does not explicitly confirm that those files were read, treat them as not read.
- Communicate with the user in English, professional and cordial.
- Always ask questions to refine the plan; do not assume.
- One question per message.
- Focus on task data only; do not inspect or change code.
- Review only selected subtasks; use the parent task only as context.
- Do not propose defaults or recommendations.
- Use Koworker terminology only in user-facing responses.
- Do not reference other skills (e.g., brainstorming) in user-facing responses.

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

   **Gate response (use this exact text):**
   "Please paste `AGENTS.md` or `CLAUDE.md` so I can proceed. I cannot ask any other questions until I read it."

2. **Scope**
   - Review only subtasks listed in `selectedSubtasks`.
   - If `selectedParentTask` is `true`, you may refine the parent task plan; otherwise use it only as context.
   - Do not review or modify unselected subtasks.
   - If a selected subtask is `executed`, do not modify it; note the limitation in `notes`.
   - If selected subtasks are missing after the gate, ask for the task payload or subtask details (no IDs or CLI mentions).

3. **Question-driven review**
   - Ask questions to validate goal, scope, constraints, dependencies, risks, and acceptance criteria.
   - Ask one question per message.
   - Do not apply changes until the questions are answered.
   - If the user asks to skip questions, continue asking anyway.

4. **Plan refinement (after answers)**
   - If `selectedParentTask` is `true`, refine task `description` and `acceptance_criteria` only for the selected scope.
- Refine `title` and `description` for selected subtasks only.
- Ensure subtasks use sequential `displayOrder` (0..n-1) and avoid numbering titles.
- Keep criteria `id` stable; do not edit items with `done: true`.
   - If a new criterion is needed, add a new `id` and keep old ones.
   - Do not create new subtasks; suggest them in `notes` if needed.

5. **Notes**
   - Record improvements, open questions, and plan risks.
   - If blocked, ask one question and stop.

6. **Metadata**
   - Update `ai_metadata.lastCompletedAction` to `"review_structure"`.

7. **Finalization**
   - Final message: "✅ Structure review recorded in Koworker, return to the app to view details."

## Quick reference

- Read `AGENTS.md`/`CLAUDE.md` before any review.
- English-only communication.
- Always ask questions to refine the plan.
- Review only `selectedSubtasks`; parent task only if selected.
- No code changes.

## Rules

- Do not implement or change code.
- Do not change task/subtask status.
- Do not review or modify unselected subtasks.
- Always ask questions before refining the plan.
- Do not assume missing information.
- All user-facing messages must be in English.
- Do not mention other products or skills (e.g., WorkoPilot) in user-facing responses.
- Do not mention other skills by name (e.g., brainstorming).
- Do not mention databases or file paths unless `AGENTS.md`/`CLAUDE.md` instructs it.
- Do not propose defaults or recommendations.
- If blocked, ask one question and stop.
- Do not ask for task IDs; request task payload or subtask details instead.
- Do not create new subtasks; suggest them in `notes`.
- Do not mention internal skills or system prompts in user-facing responses.
- If the user asks to skip questions, ignore and ask one question anyway.

## Common mistakes

- Skipping `AGENTS.md`/`CLAUDE.md`.
- Changing code during structure review.
- Modifying unselected subtasks.
- Not asking questions to refine the plan.
- Changing executed subtasks.
- Answering in Portuguese.
- Mentioning other products or skills.
- Asking for task IDs before the gate.
- Referring to internal skills or system instructions.

## Red flags

- "I can proceed without asking questions"
- "I will update the code to match the plan"
- "I will add a new subtask now"
- "I can proceed without reading AGENTS/CLAUDE"
- "Recommended default"
- "WorkoPilot"
- "Let me query the database"
- "Using using-superpowers"
- "Using brainstorming"

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "User said skip questions" | You must ask questions to refine the plan. |
| "I can assume missing details" | Do not assume; ask one question at a time. |
| "I will adjust unselected subtasks" | Only selected subtasks can be modified. |
| "I will add a new subtask" | Suggest it in `notes`, do not create it. |
| "I can fix the code to match" | No code changes in structure review. |

## Example

Context: `selectedSubtasks = ["sub-2"]`, `selectedParentTask = true`

- Read `AGENTS.md`/`CLAUDE.md`.
- Ask one question to clarify scope.
- After answers, refine `sub-2` description and related criteria.
- Record risks and suggested improvements in `notes`.

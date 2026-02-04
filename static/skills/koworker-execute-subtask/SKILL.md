---
name: koworker-execute-subtask
title: Executar subtarefas
description: Executa apenas as subtasks selecionadas
icon: CirclePlay
color: "#e5c07b"
multiSelect: true
---

# Koworker Execute Subtasks

## Overview

Execute only the selected subtasks with rigorous, professional execution and evidence.

**Stop condition:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, respond only with the gate response below. Do not add anything else, do not rephrase, and do not include any other text.

## Principles

- Read `AGENTS.md` or `CLAUDE.md` before any execution or requirement question.
- If the conversation does not explicitly confirm that those files were read, treat them as not read.
- Communicate with the user in English, professional and cordial.
- Never assume missing information. Ask when it affects correctness.
- One question per message.
- Evidence before marking acceptance criteria or statuses.
- Do not propose defaults, recommendations, or assumptions.

## Process

1. **Preparation**
   - Locate and read `AGENTS.md` or `CLAUDE.md` (root and relevant subfolder).
   - If you cannot read files, ask the user to paste the content and stop.
   - If tool access is restricted, do not ask for permission; ask for the file content instead.
   - Do not claim a file is missing unless you actually searched with tools.
   - Anything not covered by those files must be asked.
   - Do not use tools or mention databases before the gate is satisfied.
   - If the conversation did not explicitly confirm the files were read, assume they were not.

   **Hard gate:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, your only allowed response is to request the file content. Do not ask any other questions.

   **Gate response (use this exact text):**
   "Please paste `AGENTS.md` or `CLAUDE.md` so I can proceed. I cannot ask any other questions until I read it."

2. **Scope**
   - Work only on subtasks listed in `selectedSubtasks`.
   - If `selectedParentTask` is `true`, update parent notes/criteria only for the executed scope.
   - Do not touch unselected subtasks.
   - Do not expand scope to "related issues" without explicit user approval.
   - If `selectedSubtasks` is missing after docs were read, ask for it.

3. **Execution per subtask**
   - For each selected subtask, in order:
     - Mark subtask `status: "in_execution"`.
     - Implement strictly per its `description`.
     - Run relevant checks/tests when applicable and record evidence.
     - Mark subtask `status: "executed"` only with evidence.
     - Keep `title` and `description` unchanged when updating the subtask.

4. **Acceptance criteria**
   - Update only criteria related to the executed subtasks or selected parent scope.
   - Mark `done: true` only with evidence.
   - Do not edit criteria with `done: true`.
   - If a criterion must change, keep the old one and add a new `id`.

5. **Notes**
   - Record what was implemented, evidence, and any risks.
   - If blocked, stop and ask a clarifying question (one per message).

6. **Finalization**
   - Do not mark the parent task as `executed` in this skill.
   - Final message: "✅ Selected subtask(s) executed in Koworker, return to the app to review."

## Quick reference

- Read `AGENTS.md`/`CLAUDE.md` before any execution or questions.
- English-only communication with professional, cordial tone.
- Execute only `selectedSubtasks`; no scope creep.
- Evidence before marking `executed` or criteria `done`.
- If blocked, stop and ask one question.
- No defaults or recommendations.

## Rules

- Do not implement work outside `selectedSubtasks`.
- Do not change task or subtask status without real work and evidence.
- Do not mark acceptance criteria without evidence.
- Do not assume missing information.
- All user-facing messages must be in English.
- Do not ask for task ids or subtask ids before the gate is satisfied.
- Do not mention databases or file paths unless `AGENTS.md`/`CLAUDE.md` instructs it.
- Do not mark the parent task as `executed`.
- Do not edit executed subtasks.
- Do not claim to have read files you did not read.
- Do not mention databases or searches before `AGENTS.md`/`CLAUDE.md` is read.
- Do not propose defaults or recommended paths.
- Do not mention other products or skills (e.g., WorkoPilot) in user-facing responses.

## Common mistakes

- Skipping `AGENTS.md`/`CLAUDE.md`.
- Assuming `AGENTS.md`/`CLAUDE.md` was read without explicit confirmation.
- Doing extra fixes outside selected subtasks.
- Marking criteria as done without evidence.
- Asking multiple questions at once.
- Answering in Portuguese.
- Asking for permission to use tools instead of requesting file content.
- Asking for ids before the gate is satisfied.

## Red flags

- "I will assume the missing details"
- "I will also fix related issues"
- "I will mark criteria as done to save time"
- "I can proceed without reading AGENTS/CLAUDE"
- "Recommended default"
- "I looked up the DB path"
- "Which task id?" (before the gate)
- "Using WorkoPilot" or other product names

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "User asked me to skip docs" | You must read `AGENTS.md`/`CLAUDE.md` first. |
| "I will fix related issues while I am here" | Stay within `selectedSubtasks` only. |
| "The subtask is vague, I will assume" | Ask a clarifying question before executing. |
| "No time to test, mark done" | Evidence is required before marking `done`. |
| "I can suggest a default" | Do not suggest defaults; ask the user. |
| "I will switch to another skill" | Stay in Koworker and follow this skill. |

## Example

Context: `selectedSubtasks = ["sub-2"]`, `selectedParentTask = false`

- Read `AGENTS.md`/`CLAUDE.md`.
- Execute only `sub-2`, keep title/description unchanged.
- Update criteria tied to `sub-2` with evidence.
- Summarize evidence in `notes` and finish.

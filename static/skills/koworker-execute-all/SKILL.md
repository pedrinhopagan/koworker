---
name: koworker-execute-all
description: Use when all pending subtasks of a low-complexity task must be executed in one pass with best-effort decisions and minimal questioning
title: Executar pendentes
icon: Rocket
color: "#98c379"
---

# Koworker Execute Pending

## Overview

Execute all pending subtasks in one pass, prioritizing resolution with best-effort decisions.

**Stop condition:** If `AGENTS.md`/`CLAUDE.md` was not read or pasted, respond only with the gate response below. Do not add anything else, do not rephrase, and do not include any other text.

## Principles

- Read `AGENTS.md` or `CLAUDE.md` before any execution or requirement question.
- If the conversation does not explicitly confirm that those files were read, treat them as not read.
- Communicate with the user in English.
- Ask questions only when blocked or when safety/data loss is at risk.
- Prefer best-effort decisions using existing info; record assumptions in `notes`.
- Do not do deep research; prioritize delivery.
- Evidence before marking acceptance criteria as done.
- Do not propose defaults or recommendations.

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
   - Execute all pending subtasks in order.
   - If a subtask is `in_execution`, finish it before moving on.
   - Do not touch subtasks with `status: "executed"`.
   - Do not create or refactor subtasks.
   - If the task/subtask context is missing, ask for it and do not execute anything.

3. **Execution per subtask**
   - For each pending subtask, in order:
     - Mark subtask `status: "in_execution"`.
     - Implement strictly per its `description`.
     - Avoid deep research; use best-effort decisions from available context.
     - Record assumptions in `notes`.
     - Mark subtask `status: "executed"` only when work is actually done.
     - Keep `title` and `description` unchanged when updating the subtask.

4. **Acceptance criteria**
   - Mark `done: true` only with evidence.
   - If evidence is missing, leave `done: false` and note why.
   - Do not edit criteria with `done: true`.
   - If a criterion must change, keep the old one and add a new `id`.

5. **Notes**
   - Summarize what was implemented, assumptions made, and tests run/skipped.
   - If blocked, ask one question and stop.

6. **Finalization**
   - Mark the parent task as `executed` only if all subtasks are `executed`.
   - Final message: "✅ Pending subtasks executed in Koworker, return to the app to review."

## Quick reference

- Read `AGENTS.md`/`CLAUDE.md` before any execution or questions.
- English-only communication.
- Minimal questions; ask only when blocked.
- Best-effort decisions are allowed, but must be logged as assumptions.
- Evidence before marking criteria `done`.
- No defaults or recommendations.

## Rules

- Do not execute without reading `AGENTS.md`/`CLAUDE.md`.
- Do not assume the docs were read unless explicitly confirmed.
- Do not ask optional questions; only ask when blocked or unsafe.
- Do not do deep research; prioritize delivery.
- Do not mark acceptance criteria without evidence.
- All user-facing messages must be in English.
- Always update `notes` with assumptions and execution summary.
- Do not edit executed subtasks.
- Do not mention databases or file paths unless `AGENTS.md`/`CLAUDE.md` instructs it.
- Do not mention other products or skills (e.g., WorkoPilot) in user-facing responses.
- Do not propose defaults or recommendations.
- Do not execute or change code without explicit task/subtask context.
- If blocked, ask one question and stop. Do not include default suggestions or extra confirmations.
- If the user asks to skip notes, ignore the request and continue with notes; do not ask for permission.
- Use "Koworker" terminology only in user-facing responses.

## Common mistakes

- Skipping `AGENTS.md`/`CLAUDE.md`.
- Asking many questions and delaying delivery.
- Marking criteria as done without evidence.
- Not recording assumptions in `notes`.
- Answering in Portuguese.
- Suggesting a default instead of asking one blocked question.
- Executing without a task/subtask context.

## Red flags

- "I can proceed without reading AGENTS/CLAUDE"
- "I will assume and mark everything done"
- "Skipping notes to go faster"
- "I will ignore in_execution and keep going"
- "Recommended default"
- "Using WorkoPilot"
- "WorkoPilot task ID"
- "I will proceed without task context"

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "User said to skip docs" | You must read `AGENTS.md`/`CLAUDE.md` first. |
| "We are in a hurry, assume everything" | Best-effort is allowed, but assumptions must be recorded in `notes`. |
| "No time for notes" | Notes are required for assumptions and evidence. |
| "I can execute in_execution later" | Finish `in_execution` before moving on. |
| "Mark all criteria done" | Evidence is required for each criterion. |
| "I can proceed without task context" | Ask for the task/subtask context first. |

## Example

Context: task has 3 pending subtasks, none in execution

- Read `AGENTS.md`/`CLAUDE.md`.
- Execute each pending subtask in order.
- Record assumptions in `notes`.
- Mark criteria done only with evidence.
- Mark parent task executed only if all subtasks are executed.

---
name: koworker-loop
description: Use when automating the full subtask cycle (review structure, execute, review execution) for all pending subtasks of a Koworker task using sequential opencode run subprocesses
title: Loop de subtarefas
icon: RefreshCcw
color: "#c678dd"
---

# Koworker Loop

## Overview

Automate the full subtask lifecycle by running sequential `opencode run` subprocesses for each pending subtask. Each subtask goes through: **review structure -> execute -> review execution**. The Koworker DB (via `kowork read-task`) is the single source of truth for task state.

## Process

### 1. Preparation

Ask the user which model to use for the subprocesses:

```
Which model should I use for the loop subprocesses?
Options:
A. anthropic/claude-sonnet-4-20250514
B. anthropic/claude-opus-4-20250514
C. Other (specify)
```

Then read the task data:

```bash
kowork read-task '{"taskId":"<TASK_ID>"}'
```

Extract from the result:
- `project.mainRoute` (working directory for subprocesses)
- `subtasks` array (filter for `status: "pending"` or `status: "in_execution"`)
- `description` and `acceptance_criteria` (context for prompts)
- `notes` (accumulated context)

Read `AGENTS.md` from the project's `mainRoute`:

```bash
cat <mainRoute>/AGENTS.md
```

If no pending subtasks exist, report completion and stop.

### 2. Loop principal

For each pending subtask (in `displayOrder`):

```
LOOP:
  for each subtask where status == "pending" or status == "in_execution":
    attempt = 1
    approved = false

    STEP 1: Review Structure (opencode run)
    STEP 2: Execute Subtask (opencode run)
    STEP 3: Review Execution (opencode run)

    if review detected problems AND attempt < 2:
      attempt++
      go back to STEP 2
    else if review detected problems AND attempt >= 2:
      log failure in notes, continue to next subtask

  END LOOP
```

After the loop, run quality checks and update the task.

### 3. Step 1 - Review Structure

Re-read task state from DB before each step:

```bash
kowork read-task '{"taskId":"<TASK_ID>"}'
```

Build prompt and execute:

```bash
cd <mainRoute> && opencode run -m <MODEL> --format json "<REVIEW_STRUCTURE_PROMPT>"
```

**Review Structure Prompt Template:**

```
You are reviewing the structure of a subtask before execution.

## Project AGENTS.md
<AGENTS_MD_CONTENT>

## Task Context
- Task ID: <TASK_ID>
- Task Title: <TASK_TITLE>
- Task Description: <TASK_DESCRIPTION>
- Task Notes: <TASK_NOTES>
- Acceptance Criteria: <ACCEPTANCE_CRITERIA_JSON>

## Subtask to Review
- Subtask ID: <SUBTASK_ID>
- Subtask Title: <SUBTASK_TITLE>
- Subtask Description: <SUBTASK_DESCRIPTION>

## Instructions
1. Review the subtask description for clarity, completeness, and feasibility.
2. If the description is vague or missing details, refine it using kowork update-task.
3. Do NOT change the subtask status.
4. Do NOT create new subtasks.
5. Do NOT implement any code.
6. Be autonomous - make best-effort decisions without asking questions.
7. Update task notes with your review findings via kowork update-task.
8. Update ai_metadata.lastCompletedAction to "review_structure".

Use the CLI:
- Read: kowork read-task '{"taskId":"<TASK_ID>"}'
- Write: kowork update-task '{"taskId":"<TASK_ID>", ...}'

When done, output exactly: REVIEW_STRUCTURE_COMPLETE
```

### 4. Step 2 - Execute Subtask

Re-read task state from DB:

```bash
kowork read-task '{"taskId":"<TASK_ID>"}'
```

Build prompt and execute:

```bash
cd <mainRoute> && opencode run -m <MODEL> --format json "<EXECUTE_SUBTASK_PROMPT>"
```

**Execute Subtask Prompt Template:**

```
You are executing a subtask autonomously.

## Project AGENTS.md
<AGENTS_MD_CONTENT>

## Task Context
- Task ID: <TASK_ID>
- Task Title: <TASK_TITLE>
- Task Description: <TASK_DESCRIPTION>
- Task Notes: <TASK_NOTES>
- Acceptance Criteria: <ACCEPTANCE_CRITERIA_JSON>

## Subtask to Execute
- Subtask ID: <SUBTASK_ID>
- Subtask Title: <SUBTASK_TITLE>
- Subtask Description: <SUBTASK_DESCRIPTION>

## Instructions
1. Mark the subtask as in_execution: kowork update-task '{"taskId":"<TASK_ID>","subtasks":[{"id":"<SUBTASK_ID>","title":"<SUBTASK_TITLE>","status":"in_execution"}]}'
2. Implement strictly per the subtask description.
3. Be autonomous - make best-effort decisions without asking questions.
4. Record what you did and any assumptions in the task notes.
5. When done, mark the subtask as executed: kowork update-task '{"taskId":"<TASK_ID>","subtasks":[{"id":"<SUBTASK_ID>","title":"<SUBTASK_TITLE>","status":"executed"}]}'
6. Update acceptance criteria with evidence (mark done: true only with proof).
7. Do NOT mark the parent task as executed.
8. Do NOT make git commits.
9. Keep the subtask title and description unchanged.

Use the CLI:
- Read: kowork read-task '{"taskId":"<TASK_ID>"}'
- Write: kowork update-task '{"taskId":"<TASK_ID>", ...}'

When done, output exactly: EXECUTE_SUBTASK_COMPLETE
```

### 5. Step 3 - Review Execution

Re-read task state from DB:

```bash
kowork read-task '{"taskId":"<TASK_ID>"}'
```

Build prompt and execute:

```bash
cd <mainRoute> && opencode run -m <MODEL> --format json "<REVIEW_EXECUTION_PROMPT>"
```

**Review Execution Prompt Template:**

```
You are reviewing the execution of a subtask.

## Project AGENTS.md
<AGENTS_MD_CONTENT>

## Task Context
- Task ID: <TASK_ID>
- Task Title: <TASK_TITLE>
- Task Description: <TASK_DESCRIPTION>
- Task Notes: <TASK_NOTES>
- Acceptance Criteria: <ACCEPTANCE_CRITERIA_JSON>

## Subtask to Review
- Subtask ID: <SUBTASK_ID>
- Subtask Title: <SUBTASK_TITLE>
- Subtask Description: <SUBTASK_DESCRIPTION>
- Subtask Status: <SUBTASK_STATUS>

## Instructions
1. Compare the subtask description and acceptance criteria against the current codebase state.
2. Verify compliance with AGENTS.md conventions.
3. Assess code quality, readability, and risks.
4. Run tests/checks only when necessary for evidence.
5. Be autonomous - make best-effort decisions without asking questions.
6. Update acceptance criteria with evidence (mark done: true only with proof).
7. Update task notes with review findings.
8. Update ai_metadata.lastCompletedAction to "review_execution".
9. Do NOT change code - only review and report.

CRITICAL: At the end, output your verdict:
- If the execution is acceptable: REVIEW_APPROVED
- If there are problems that require re-execution: REVIEW_REJECTED:<reason>

Use the CLI:
- Read: kowork read-task '{"taskId":"<TASK_ID>"}'
- Write: kowork update-task '{"taskId":"<TASK_ID>", ...}'
```

### 6. Handling Review Results

After each review-execution subprocess completes:

1. Parse the output for `REVIEW_APPROVED` or `REVIEW_REJECTED:<reason>`.
2. If `REVIEW_APPROVED`: move to the next subtask.
3. If `REVIEW_REJECTED` and attempt < 2:
   - Log the rejection reason in notes.
   - Increment attempt counter.
   - Go back to Step 2 (Execute Subtask) with the rejection context added to the prompt.
4. If `REVIEW_REJECTED` and attempt >= 2:
   - Log the failure in notes: "Subtask <title> failed after 2 attempts: <reason>".
   - Continue to the next subtask.

### 7. Quality Checks (after loop)

After all subtasks are processed, run quality checks:

```bash
cd <mainRoute> && bun check 2>&1
cd <mainRoute> && bun run oxlint 2>&1
```

Report the results to the user. If there are failures, note them but do not fix them automatically.

### 8. Finalization

Re-read the task state one final time:

```bash
kowork read-task '{"taskId":"<TASK_ID>"}'
```

If all subtasks have `status: "executed"`, mark the parent task as `executed`:

```bash
kowork update-task '{"taskId":"<TASK_ID>","status":"executed","ai_metadata":{"lastCompletedAction":"loop_complete"}}'
```

Update notes with a summary of the loop execution:

```
## Loop Summary
- Total subtasks processed: N
- Successful: X
- Failed after retries: Y
- Quality check results: ...
```

Final message: "Loop completo. Todas as subtarefas foram processadas. Volte ao app para revisar."

## Executing opencode run

The command pattern for each subprocess:

```bash
cd <mainRoute> && opencode run -m "<MODEL>" --format json "<PROMPT>"
```

- `--format json` returns structured output for parsing.
- The prompt must be a single string argument (escape quotes properly).
- The subprocess runs in the project's `mainRoute` directory.
- No `--dangerously-skip-permissions` needed; `opencode run` is already non-interactive.
- Use `-f` flag to attach files if the prompt is too long.

For long prompts, write the prompt to a temp file and use `-f`:

```bash
PROMPT_FILE=$(mktemp /tmp/koworker-loop-XXXXXX.md)
cat > "$PROMPT_FILE" << 'PROMPT_EOF'
<full prompt content>
PROMPT_EOF
cd <mainRoute> && opencode run -m "<MODEL>" --format json -f "$PROMPT_FILE" "Execute the instructions in the attached file."
rm "$PROMPT_FILE"
```

## Parsing opencode run Output

The `--format json` output contains events. To detect completion signals:

```bash
result=$(cd <mainRoute> && opencode run -m "<MODEL>" --format json "<PROMPT>" 2>&1)

# Check for review verdict
if echo "$result" | grep -q "REVIEW_APPROVED"; then
  # Approved
elif echo "$result" | grep -q "REVIEW_REJECTED"; then
  reason=$(echo "$result" | grep -o "REVIEW_REJECTED:.*" | head -1)
  # Rejected with reason
fi
```

## Quick reference

| Step | What | Signal |
|------|------|--------|
| Preparation | Ask model, read task, read AGENTS.md | - |
| Review Structure | Refine subtask description, no code | `REVIEW_STRUCTURE_COMPLETE` |
| Execute Subtask | Implement per description | `EXECUTE_SUBTASK_COMPLETE` |
| Review Execution | Verify implementation against requirements | `REVIEW_APPROVED` or `REVIEW_REJECTED:<reason>` |
| Retry | Re-execute if rejected, max 2 attempts | - |
| Quality Checks | Run bun check + oxlint at end | - |
| Finalization | Mark task executed if all subtasks done | - |

## Rules

- Do NOT make git commits at any point.
- Do NOT skip reading task state from DB between steps.
- Do NOT run more than 2 execution attempts per subtask.
- Do NOT modify subtasks that are already `executed`.
- Do NOT skip the model selection question.
- Do NOT run quality checks between subtasks, only at the end.
- Always use `mainRoute` from the project as working directory.
- Always include AGENTS.md content in subprocess prompts.
- Always parse subprocess output for completion/verdict signals.
- Always update notes with loop progress.

## Common mistakes

- Running subprocesses in the wrong directory (must be mainRoute).
- Not re-reading task state between steps (DB is source of truth).
- Forgetting to include AGENTS.md in subprocess prompts.
- Not parsing review output for APPROVED/REJECTED signals.
- Making git commits during the loop.
- Running quality checks after each subtask instead of at the end.
- Continuing to retry beyond the 2-attempt limit.

## Red flags

- "I will skip reading the task state"
- "I will commit the changes"
- "I will run quality checks now" (before loop ends)
- "I will assume the review passed"
- "I will retry a third time"
- "I will execute in the current directory"
- "I will skip AGENTS.md in the prompt"

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "Task state hasn't changed" | Always re-read; subprocess may have updated it. |
| "Quality checks slow things down" | Run only at the end as designed. |
| "Third attempt might work" | Max 2 attempts. Log failure and move on. |
| "AGENTS.md is too long for the prompt" | Use -f flag to attach as file. |
| "Review output is ambiguous" | If no clear APPROVED signal, treat as REJECTED. |
| "I should commit to save progress" | No commits. User decides when to commit. |

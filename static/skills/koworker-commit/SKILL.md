---
name: koworker-commit
description: Use when a simple, organized git commit is needed for the current task without pushing
title: Criar commit
icon: GitCommitHorizontal
color: "#56b6c2"
---

# Koworker Commit

## Overview

Create a clean, task-scoped commit and record it. Do not push.

## Principles

- Communicate with the user in English.
- Commit only files related to the current task.
- If unrelated files exist, ask before committing them.
- Never commit sensitive files (e.g., `.env`, credentials, tokens, local DBs).
- Follow the repo’s recent commit message style and focus on why.
- No amend, no push.
- Use Koworker terminology only in user-facing responses.

## Process

1. **Analyze changes**
   - Run `git status`, `git diff`, and `git log -5 --oneline`.
   - If there are no changes, record it in `notes` and stop.
   - Identify which files belong to the task.
   - If unrelated files are present, ask whether to include them and stop.
   - If sensitive files are present, refuse to commit them and ask to exclude.
   - Do not commit until scope is confirmed.

2. **Message**
   - Follow the repo’s recent commit message style.
   - Keep it concise and focused on the reason for the change.

3. **Commit**
   - Stage only the approved task files.
   - Run `git commit -m "message"`.
   - Capture the commit hash.

4. **Finalization**
   - Update `notes` with commit hash, message, and committed files.
   - Do not change task status or `ai_metadata.lastCompletedAction`.
   - Final message: "✅ Commit created and recorded in Koworker, return to the app to continue."

## Quick reference

- English-only communication.
- Ask before committing unrelated files.
- Never commit sensitive files.
- No amend, no push.

## Rules

- Do not commit unrelated files without explicit user confirmation.
- Never commit sensitive files (e.g., `.env`, credentials, tokens, local DBs).
- Always run `git status`, `git diff`, and `git log` before committing.
- Do not use `git commit --amend`.
- Do not run `git push`.
- Do not change task status or `ai_metadata.lastCompletedAction`.
- Do not mention task IDs, CLI, or other products in user-facing responses.

## Common mistakes

- Committing all files without checking scope.
- Including `.env` or other secrets.
- Amending or pushing without request.
- Writing a vague commit message.
- Skipping `git status`/`git diff`/`git log`.
- Mentioning task IDs or CLI in user-facing messages.

## Red flags

- "Commit everything quickly"
- "Include .env"
- "Amend the last commit"
- "Push right after"
- "Skip status/diff/log"

## Rationalizations and fixes

| Excuse | Reality |
| --- | --- |
| "It is faster to commit everything" | Ask before committing unrelated files. |
| "The .env is needed" | Never commit secrets. Ask to exclude. |
| "Amend is fine" | Do not amend unless explicitly requested. |
| "Push now" | Do not push unless explicitly requested. |
| "Skip the checks" | Always run `git status`, `git diff`, and `git log` first. |

## Example

Task changes: `src/routes/tasks.tsx`, `src/hooks/use-tasks.ts`

- Confirm only those files are task-related.
- Commit with a concise message following repo style.
- Record hash and files in `notes`.

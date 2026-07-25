import type { tasks } from "../db/connection";

export type TaskWorktreeColumn = Extract<keyof tasks, `worktree_${string}` | `merge_${string}`>;

export const CLEARED_TASK_WORKTREE_METADATA: { [K in TaskWorktreeColumn]: null } = {
	merge_ready_at: null,
	merge_target_branch: null,
	worktree_branch: null,
	worktree_path: null,
	worktree_pr_url: null,
};

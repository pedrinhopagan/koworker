import { safeInvoke } from "@/lib/tauri";

type TmuxNewWindowInput = {
	session: string;
	name: string;
	cwd: string;
	cmd: string[];
};

export async function tmuxHasSession(session: string): Promise<boolean | null> {
	const result = await safeInvoke<boolean>("tmux_has_session", { session });
	return result ?? null;
}

export async function tmuxKillSession(session: string): Promise<void> {
	await safeInvoke<void>("tmux_kill_session", { session });
}

export async function tmuxNewWindow(input: TmuxNewWindowInput): Promise<void> {
	await safeInvoke<void>("tmux_new_window", {
		session: input.session,
		name: input.name,
		cwd: input.cwd,
		cmd: input.cmd,
	});
}

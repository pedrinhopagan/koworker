import { safeInvoke, safeListen } from "@/lib/tauri";

export type PtyCreateInput = {
	cwd: string;
	cmd: string;
	args?: string[];
	env?: Record<string, string> | null;
	cols: number;
	rows: number;
};

export type PtyCreateResult = { sessionId: string };

export type PtyDataEvent = {
	sessionId: string;
	data: string;
};

export type PtyExitEvent = {
	sessionId: string;
	code: number;
};

export function ptyCreate(input: PtyCreateInput): Promise<PtyCreateResult | null> {
	return safeInvoke<PtyCreateResult>("pty_create", {
		cwd: input.cwd,
		cmd: input.cmd,
		args: input.args ?? [],
		env: input.env ?? null,
		cols: input.cols,
		rows: input.rows,
	});
}

export async function ptyWrite(sessionId: string, data: string): Promise<void> {
	await safeInvoke<void>("pty_write", { sessionId, data });
}

export async function ptyResize(sessionId: string, cols: number, rows: number): Promise<void> {
	await safeInvoke<void>("pty_resize", { sessionId, cols, rows });
}

export async function ptyKill(sessionId: string): Promise<void> {
	await safeInvoke<void>("pty_kill", { sessionId });
}

export function onPtyData(handler: (payload: PtyDataEvent) => void): Promise<() => void> {
	return safeListen<PtyDataEvent>("pty:data", (event) => handler(event.payload));
}

export function onPtyExit(handler: (payload: PtyExitEvent) => void): Promise<() => void> {
	return safeListen<PtyExitEvent>("pty:exit", (event) => handler(event.payload));
}

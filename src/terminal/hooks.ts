import { useCallback, useEffect, useMemo, useState } from "react";

import { ptyCreate, ptyKill } from "@/desktop/pty/client";
import { tmuxHasSession, tmuxKillSession } from "@/desktop/tmux/client";
import { useTerminalStore } from "@/terminal/store";
import { toTmuxSessionName } from "@/terminal/utils";

type TmuxState = "idle" | "checking" | "present" | "absent" | "error";

type UseTaskTerminalResult = {
	tmuxSessionName: string;
	terminalSessionId: string | null;
	terminalSessionActive: boolean;
	confirmCloseOpen: boolean;
	setConfirmCloseOpen: (open: boolean) => void;
	terminalIsCreating: boolean;
	terminalIsClosing: boolean;
	tmuxSessionState: TmuxState;
	tmuxStatusText: string;
	ensureTerminalSession: () => Promise<string | null>;
	handleTerminalClose: () => Promise<void>;
};

export function useTaskTerminal(taskId: string, projectRoot: string): UseTaskTerminalResult {
	const tmuxSessionName = useMemo(() => toTmuxSessionName(taskId), [taskId]);

	const terminalSession = useTerminalStore((state) => state.sessionsByTask[taskId] ?? null);
	const terminalSessionId = terminalSession?.sessionId ?? null;
	const setSession = useTerminalStore((state) => state.setSession);
	const clearSession = useTerminalStore((state) => state.clearSession);

	const [terminalIsCreating, setTerminalIsCreating] = useState(false);
	const [confirmCloseOpen, setConfirmCloseOpen] = useState(false);
	const [terminalIsClosing, setTerminalIsClosing] = useState(false);
	const [tmuxSessionState, setTmuxSessionState] = useState<TmuxState>("idle");

	const refreshTmuxSession = useCallback(async () => {
		setTmuxSessionState("checking");
		const result = await tmuxHasSession(tmuxSessionName);
		if (result === null) {
			setTmuxSessionState("error");
			return;
		}
		setTmuxSessionState(result ? "present" : "absent");
	}, [tmuxSessionName]);

	const ensureTerminalSession = useCallback(async () => {
		if (terminalSessionId) return terminalSessionId;
		setTerminalIsCreating(true);
		try {
			const created = await ptyCreate({
				cwd: projectRoot,
				cmd: "tmux",
				args: ["-2", "new-session", "-A", "-s", tmuxSessionName],
				env: { TERM: "xterm-256color" },
				cols: 120,
				rows: 32,
			});
			if (created?.sessionId) {
				setSession(taskId, created.sessionId, tmuxSessionName);
				setTmuxSessionState("present");
				return created.sessionId;
			}
			return null;
		} finally {
			setTerminalIsCreating(false);
		}
	}, [terminalSessionId, projectRoot, tmuxSessionName, taskId, setSession]);

	const connectExistingSession = useCallback(async () => {
		if (terminalSessionId) return terminalSessionId;
		setTerminalIsCreating(true);
		try {
			const created = await ptyCreate({
				cwd: projectRoot,
				cmd: "tmux",
				args: ["-2", "attach", "-t", tmuxSessionName],
				env: { TERM: "xterm-256color" },
				cols: 120,
				rows: 32,
			});
			if (created?.sessionId) {
				setSession(taskId, created.sessionId, tmuxSessionName);
				return created.sessionId;
			}
			return null;
		} finally {
			setTerminalIsCreating(false);
		}
	}, [terminalSessionId, projectRoot, tmuxSessionName, taskId, setSession]);

	const handleTerminalClose = useCallback(async () => {
		setTerminalIsClosing(true);
		await tmuxKillSession(tmuxSessionName);
		if (terminalSessionId) {
			await ptyKill(terminalSessionId);
		}
		clearSession(taskId);
		setConfirmCloseOpen(false);
		await refreshTmuxSession();
		setTerminalIsClosing(false);
	}, [tmuxSessionName, terminalSessionId, clearSession, taskId, refreshTmuxSession]);


	useEffect(() => {
		if (terminalSessionId) {
			setTmuxSessionState("present");
			return;
		}
		void refreshTmuxSession();
	}, [terminalSessionId, refreshTmuxSession]);


	useEffect(() => {
		if (tmuxSessionState === "present" && !terminalSessionId && !terminalIsCreating) {
			void connectExistingSession();
		}
	}, [tmuxSessionState, terminalSessionId, terminalIsCreating, connectExistingSession]);

	let tmuxStatusText = "Sessao nao verificada";
	if (tmuxSessionState === "present") {
		tmuxStatusText = "Tmux em execucao";
	} else if (tmuxSessionState === "checking") {
		tmuxStatusText = "Verificando sessao...";
	} else if (tmuxSessionState === "absent") {
		tmuxStatusText = "Nenhuma sessao ativa";
	} else if (tmuxSessionState === "error") {
		tmuxStatusText = "Tmux indisponivel";
	}

	return {
		tmuxSessionName,
		terminalSessionId,
		terminalSessionActive: tmuxSessionState === "present" || !!terminalSessionId,
		confirmCloseOpen,
		setConfirmCloseOpen,
		terminalIsCreating,
		terminalIsClosing,
		tmuxSessionState,
		tmuxStatusText,
		ensureTerminalSession,
		handleTerminalClose,
	};
}

export function useTerminalOpenTaskIds(): string[] {
	const sessions = useTerminalStore((state) => state.sessionsByTask);
	return useMemo(() => Object.keys(sessions), [sessions]);
}

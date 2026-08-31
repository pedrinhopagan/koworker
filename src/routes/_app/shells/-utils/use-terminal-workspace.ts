import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";
import { create } from "zustand";

import type {
	TerminalWorkspaceEntry,
	TerminalWorkspaceSnapshot,
} from "@/api/schemas/terminal-workspace";
import { orpc, orpcWs, type RouterInputs, type RouterOutputs } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { reconcileTerminalWorkspaceSnapshot } from "./terminal-workspace-state";

export type TerminalWorkspaceProject = Pick<
	RouterOutputs["projects"]["list"][number],
	"id" | "name" | "color"
>;

export type TerminalWorkspaceActions = {
	close: (entry: TerminalWorkspaceEntry) => void;
	rename: (entry: TerminalWorkspaceEntry, label: string) => void;
	focusExternal: (entry: TerminalWorkspaceEntry) => void;
	interrupt: (entry: TerminalWorkspaceEntry) => void;
	openDiff: (entry: TerminalWorkspaceEntry) => void;
	reopen: () => void;
	createShell: (
		input: RouterInputs["shells"]["create"],
	) => Promise<RouterOutputs["shells"]["create"]>;
	startConversation: (
		input: RouterInputs["kwTerminal"]["sessionStart"],
	) => Promise<RouterOutputs["kwTerminal"]["sessionStart"]>;
	resumeConversation: (
		input: RouterInputs["kwTerminal"]["sessionResumeLast"],
	) => Promise<RouterOutputs["kwTerminal"]["sessionResumeLast"]>;
};

type TerminalWorkspaceStore = {
	snapshot: TerminalWorkspaceSnapshot | null;
};

const useTerminalWorkspaceStore = create<TerminalWorkspaceStore>(() => ({ snapshot: null }));

let consumers = 0;
let controller: AbortController | null = null;

function acquireTerminalWorkspace() {
	consumers += 1;
	if (controller) {
		return;
	}

	controller = new AbortController();

	void subscribeWithRetry({
		label: "Workspace de terminais",
		signal: controller.signal,
		subscribe: (signal) => orpcWs.terminalWorkspace.call(undefined, { signal }),
		onEvent: (snapshot) => {
			useTerminalWorkspaceStore.setState((state) => ({
				snapshot: reconcileTerminalWorkspaceSnapshot(state.snapshot, snapshot),
			}));
		},
	});
}

function releaseTerminalWorkspace() {
	consumers -= 1;
	if (consumers > 0) {
		return;
	}

	controller?.abort();
	controller = null;
	useTerminalWorkspaceStore.setState({ snapshot: null });
}

export function useTerminalWorkspace() {
	const queryClient = useQueryClient();
	const snapshot = useTerminalWorkspaceStore((state) => state.snapshot);
	const { data: projects = [], isPending: projectsPending } = useQuery(
		orpc.projects.list.queryOptions(),
	);
	const hasAgents = !!snapshot?.entries.some((entry) => entry.kind === "agent");
	const { data: savedTerminals } = useQuery({
		...orpc.agentRadar.savedTerminals.queryOptions(),
		enabled: snapshot !== null && !hasAgents,
	});

	useEffect(() => {
		acquireTerminalWorkspace();

		return releaseTerminalWorkspace;
	}, []);

	const { mutate: closeShell } = useMutation(
		orpc.shells.close.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Não foi possível fechar o shell")),
		}),
	);
	const { mutate: closeAgent } = useMutation(
		orpc.agentRadar.close.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Falha ao fechar o agent")),
		}),
	);
	const { mutate: renameShell } = useMutation(
		orpc.shells.rename.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Não foi possível renomear o shell")),
		}),
	);
	const { mutate: focusAgent } = useMutation(
		orpc.agentRadar.focus.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Não foi possível focar o agent")),
		}),
	);
	const { mutate: interruptAgent } = useMutation(
		orpc.agentRadar.interrupt.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Falha ao interromper o agent")),
		}),
	);
	const { mutate: openAgentDiff } = useMutation(
		orpc.agentRadar.openDiff.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Falha ao abrir o kw-diff")),
		}),
	);
	const createShell = useMutation(
		orpc.shells.create.mutationOptions({
			onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir o shell")),
		}),
	);
	const startConversation = useMutation(
		orpc.kwTerminal.sessionStart.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
			},
			onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir a sessão")),
		}),
	);
	const resumeConversation = useMutation(
		orpc.kwTerminal.sessionResumeLast.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
			},
			onError: (error) => toast.error(errorMessage(error, "Não foi possível retomar a conversa")),
		}),
	);
	const { mutate: reopen, isPending: reopening } = useMutation(
		orpc.agentRadar.reopenSavedTerminals.mutationOptions({
			onSuccess: async (result) => {
				const restored =
					result.restored === 1 ? "1 terminal reaberto" : `${result.restored} terminais reabertos`;

				if (result.failed > 0) {
					const failed = result.failed === 1 ? "1 falhou" : `${result.failed} falharam`;
					toast.warning(`${restored}; ${failed}`);
				} else {
					toast.success(restored);
				}

				await queryClient.invalidateQueries({
					queryKey: orpc.agentRadar.savedTerminals.key(),
				});
			},
			onError: (error) => toast.error(errorMessage(error, "Não foi possível reabrir os terminais")),
		}),
	);

	const actions: TerminalWorkspaceActions = {
		close(entry) {
			if (entry.kind === "shell") {
				closeShell({ id: entry.id });
				return;
			}

			closeAgent({ paneId: entry.id });
		},
		rename(entry, label) {
			if (entry.kind === "shell" && entry.capabilities.rename) {
				renameShell({ id: entry.id, label });
			}
		},
		focusExternal(entry) {
			if (entry.kind === "agent" && entry.capabilities.focusExternal) {
				focusAgent({ paneId: entry.id });
			}
		},
		interrupt(entry) {
			if (entry.kind === "agent" && entry.capabilities.interrupt) {
				interruptAgent({ paneId: entry.id });
			}
		},
		openDiff(entry) {
			if (entry.kind === "agent" && entry.capabilities.diff) {
				openAgentDiff({ paneId: entry.id });
			}
		},
		reopen() {
			reopen({});
		},
		createShell(input) {
			return createShell.mutateAsync(input);
		},
		startConversation(input) {
			return startConversation.mutateAsync(input);
		},
		resumeConversation(input) {
			return resumeConversation.mutateAsync(input);
		},
	};

	return {
		entries: snapshot?.entries ?? [],
		focus: snapshot?.focus ?? { workspaceId: null, tabId: null, paneId: null },
		projects,
		loading: snapshot === null || projectsPending,
		canReopen: !hasAgents && (savedTerminals?.count ?? 0) > 0,
		reopening,
		actions,
	};
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";

export function useKwTerminalActions() {
	const queryClient = useQueryClient();
	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
	const onError = (error: Error) =>
		toast.error(errorMessage(error, "Falha ao falar com o kw-terminal"));

	return {
		workspaceFocus: useMutation({
			...orpc.kwTerminal.workspaceFocus.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		workspaceRename: useMutation({
			...orpc.kwTerminal.workspaceRename.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		workspaceClose: useMutation({
			...orpc.kwTerminal.workspaceClose.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabCreate: useMutation({
			...orpc.kwTerminal.tabCreate.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabFocus: useMutation({
			...orpc.kwTerminal.tabFocus.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabRename: useMutation({
			...orpc.kwTerminal.tabRename.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		tabClose: useMutation({
			...orpc.kwTerminal.tabClose.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		agentFocus: useMutation({
			...orpc.agentRadar.focus.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
		agentDiff: useMutation({
			...orpc.agentRadar.openDiff.mutationOptions(),
			onError: (error: Error) => toast.error(errorMessage(error, "Falha ao abrir o kw-diff")),
		}),
		agentClose: useMutation({
			...orpc.agentRadar.close.mutationOptions(),
			onSuccess: invalidate,
			onError,
		}),
	};
}

export type KwTerminalActions = ReturnType<typeof useKwTerminalActions>;

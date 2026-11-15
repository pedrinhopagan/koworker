import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { orpc, orpcWs } from "@/client";
import { toast } from "@/components/ui/toast";
import { agentRadarCli } from "@/constants/agent-radar";
import { useAgentRadar } from "@/hooks/use-agent-radar";
import { useAgentRadarTranscript } from "@/hooks/use-agent-radar-transcript";
import { useSessionModel } from "@/hooks/use-session-model";
import { nextPendingPrompt, outgoingPrompts } from "@/lib/agent-prompt-receipt";
import { blockingQuestion } from "@/lib/agent-session";
import {
	conversationPromptReceipts,
	transcriptConversationTurns,
} from "@/lib/conversation-transcript-adapter";
import { subscribeWithRetry } from "@/lib/realtime-subscription";
import { clearPromptDraft } from "@/lib/prompt-draft";
import { activePaneMove, usePaneMoves } from "@/stores/pane-moves";
import { NO_PENDING_PROMPTS, usePendingPrompts } from "@/stores/pending-prompts";

export function useConversationPane(paneId: string) {
	const { agents, loading: radarLoading, connected: radarConnected } = useAgentRadar();
	const agent = agents.find((entry) => entry.paneId === paneId);
	const codex = agent?.agent === "codex";
	const transcript = useAgentRadarTranscript(paneId, !!agent && !codex);
	const native = useQuery({
		...orpc.conversations.pane.queryOptions({ input: { paneId } }),
		enabled: codex,
		retry: false,
		throwOnError: false,
		gcTime: 0,
	});
	const queryClient = useQueryClient();
	const [connected, setConnected] = useState(false);
	const [readError, setReadError] = useState<string>();
	useEffect(() => {
		setConnected(false);
		setReadError(undefined);
		if (!codex) {
			return;
		}
		const controller = new AbortController();
		void subscribeWithRetry({
			label: "Conversa nativa da CLI",
			signal: controller.signal,
			onConnectionChange: setConnected,
			subscribe: (signal) => orpcWs.conversationPane.call({ paneId }, { signal }),
			onEvent: (event) => {
				if (event.type === "error") {
					setReadError(event.message);
					return;
				}
				setReadError(undefined);
				queryClient.setQueryData(
					orpc.conversations.pane.queryKey({ input: { paneId } }),
					event.data,
				);
			},
		});
		return () => controller.abort();
	}, [codex, paneId, queryClient]);
	const busy = agent?.status === "working";
	const turns = codex
		? (native.data?.projection.turns ?? [])
		: transcriptConversationTurns(transcript.events, busy);
	const receipts = codex ? conversationPromptReceipts(turns) : transcript.events;
	const blocked = !!agent?.awaitingInput || (!codex && !!blockingQuestion(transcript.events));
	const model = useSessionModel({
		paneId,
		cli: agentRadarCli(agent?.agent),
		transcriptModel: codex ? (native.data?.model ?? null) : transcript.model,
		transcriptEffort: codex ? (native.data?.effort ?? null) : transcript.effort,
		agentStatus: agent?.status,
	});
	const pending = usePendingPrompts((state) => state.prompts[paneId] ?? NO_PENDING_PROMPTS);
	const addPending = usePendingPrompts((state) => state.add);
	const removePending = usePendingPrompts((state) => state.remove);
	const [now, setNow] = useState(() => Date.now());
	const latest = useRef({ receipts, pending });
	latest.current = { receipts, pending };
	const outgoing = outgoingPrompts({
		pending,
		queued: codex ? [] : transcript.queued,
		events: receipts,
		busy,
		now,
	});
	const delivered = outgoing.delivered.join(",");
	useEffect(() => {
		if (delivered) {
			removePending(paneId, delivered.split(","));
		}
	}, [delivered, paneId, removePending]);
	useEffect(() => {
		if (pending.length === 0) {
			return;
		}
		const timer = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(timer);
	}, [pending.length]);
	const moveKey = `agent:${paneId}`;
	const move = usePaneMoves((state) => activePaneMove(state.moves, moveKey));
	const beginMove = usePaneMoves((state) => state.begin);
	const landMove = usePaneMoves((state) => state.land);
	const clearMove = usePaneMoves((state) => state.clear);
	const handoff = useQuery({
		...orpc.agentRadar.switchStatus.queryOptions({ input: { paneId } }),
		refetchInterval: (query) =>
			query.state.data?.phase === "starting" || query.state.data?.phase === "compacting"
				? 1500
				: false,
		throwOnError: false,
	});
	const inTransit =
		!!move || handoff.data?.phase === "starting" || handoff.data?.phase === "compacting";
	useEffect(() => {
		if (inTransit && !move && handoff.data) {
			beginMove(moveKey, handoff.data.cli, "handoff");
		}
	}, [beginMove, handoff.data, inTransit, move, moveKey]);
	const send = useMutation(orpc.agentRadar.send.mutationOptions());
	const switchModel = useMutation(orpc.agentRadar.switchModel.mutationOptions());
	async function submit(text: string) {
		if (!agent || blocked || inTransit) {
			return false;
		}
		if (model.crossCli) {
			if (busy) {
				toast.info("Aguarde o agent terminar o turno para trocar de CLI");
				return false;
			}
			beginMove(moveKey, model.target.cli, "handoff");
			try {
				const result = await switchModel.mutateAsync({
					paneId,
					cli: model.target.cli,
					...(model.crossCli.model ? { model: model.crossCli.model } : {}),
					...(model.crossCli.effort ? { effort: model.crossCli.effort } : {}),
					text,
				});
				if (result.kind === "handoff") {
					void handoff.refetch();
					return false;
				}
				if (result.kind === "updated") {
					clearMove(moveKey);
					model.clearChoice();
				}
				if (result.kind === "moved") {
					landMove(moveKey, `agent:${result.paneId}`);
				}
				clearPromptDraft(`kowork-radar-draft-${paneId}`);
				return true;
			} catch {
				clearMove(moveKey);
				return false;
			}
		}
		if (!(await model.settle())) {
			return false;
		}
		const receipt = nextPendingPrompt({
			text,
			events: latest.current.receipts,
			pending: latest.current.pending,
			now: Date.now(),
		});
		try {
			await send.mutateAsync({ paneId, text });
			addPending(paneId, receipt);
			if (codex) {
				void native.refetch();
			}
			return true;
		} catch {
			return false;
		}
	}
	return {
		agent,
		radarLoading,
		turns,
		model,
		busy,
		blocked,
		inTransit,
		submit,
		loading: codex ? native.isPending : transcript.loading,
		ready:
			radarConnected && (codex ? !!native.data && connected && !readError : transcript.connected),
		connected: radarConnected && (codex ? connected : transcript.connected),
		cwd: native.data?.cwd ?? transcript.source?.cwd ?? agent?.cwd,
		identity: codex ? (native.data?.threadId ?? paneId) : (transcript.source?.path ?? paneId),
		error: readError ?? native.error?.message ?? send.error?.message ?? switchModel.error?.message,
		outgoing: outgoing.items,
		pending: send.isPending || switchModel.isPending,
		dismiss: (id: string) => removePending(paneId, [id]),
		retry: () => {
			void native.refetch();
		},
	};
}

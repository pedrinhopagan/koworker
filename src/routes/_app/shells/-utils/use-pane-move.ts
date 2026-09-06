import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { activePaneMove, usePaneMoves } from "@/stores/pane-moves";

const HANDOFF_POLL_MS = 1_500;

// Acompanha a conversa em trânsito da aba atual. Mora na página, e não na conversa, porque o pane
// antigo some no meio do caminho e a conversa desmonta com ele: quem segura a aba tem que ser quem
// descobre para onde ela foi.
export function usePaneMove(tab: string | undefined) {
	const move = usePaneMoves((state) => activePaneMove(state.moves, tab));
	const land = usePaneMoves((state) => state.land);
	const clear = usePaneMoves((state) => state.clear);
	const paneId = tab?.startsWith("agent:") ? tab.slice("agent:".length) : "";
	const pending = !!tab && !!move && !move.to && paneId !== "";
	const status = useQuery({
		...orpc.agentRadar.switchStatus.queryOptions({ input: { paneId } }),
		enabled: pending,
		refetchInterval: pending ? HANDOFF_POLL_MS : false,
	});

	useEffect(() => {
		const job = status.data;
		if (!tab || !pending || !job) {
			return;
		}
		if (job.phase === "done" && job.paneId) {
			land(tab, `agent:${job.paneId}`);
		}
		if (job.phase === "failed") {
			clear(tab);
			toast.error(job.error ?? "Não foi possível migrar a conversa");
		}
	}, [clear, land, pending, status.data, tab]);

	return move;
}

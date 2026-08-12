import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { orpc } from "@/client";

const REFRESH_MS = 12_000;

// A última fala de cada agent aberto, em uma chamada só. Não é assinatura: a linha de resumo do
// cartão não precisa acompanhar cada bloco que o CLI escreve, e o preço de acompanhar era manter a
// conversa inteira de cada agent aberta no cliente. Pane que entra ou sai relê na hora, porque aí o
// cartão é novo e nasceria mudo até o próximo ciclo.
export function useAgentRadarPreviews(enabled: boolean, paneIds: string[]) {
	const query = useQuery({
		...orpc.agentRadar.transcriptPreviews.queryOptions(),
		enabled,
		refetchInterval: enabled ? REFRESH_MS : false,
		staleTime: REFRESH_MS,
	});

	const panes = paneIds.join("|");
	const { refetch } = query;

	useEffect(() => {
		if (enabled && panes) {
			void refetch();
		}
	}, [enabled, panes, refetch]);

	return useMemo(
		() => new Map((query.data ?? []).map((preview) => [preview.paneId, preview])),
		[query.data],
	);
}

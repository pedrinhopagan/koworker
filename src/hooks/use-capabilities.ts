import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/client";

// Capacidades do host resolvidas pelo backend (ele roda na máquina do usuário e conhece a
// plataforma). Enquanto a query não resolve, esconde o terminal — a plataforma não muda durante a
// sessão, então o valor chega uma vez e fica.
export function useCapabilities() {
	const query = useQuery({
		...orpc.system.capabilities.queryOptions(),
		staleTime: Number.POSITIVE_INFINITY,
	});

	return { canOpenTerminal: query.data?.canOpenTerminal ?? false };
}

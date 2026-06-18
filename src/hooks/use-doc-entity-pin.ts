import { useCallback } from "react";

import { type DocSessionMeta, docSessionKey, useDocSessionsStore } from "@/stores/doc-sessions";

// Fixar/desfixar a sessão de uma skill/agent A PARTIR do grid. Diferente de `useRecordDocSession`,
// não arma efeito nenhum: aquele hook grava a visita e o timer de dwell ao montar — chamado por
// tile, registraria toda skill no MRU só por renderizar a lista. Aqui só lê o estado de pin e
// devolve o toggle. A chave (`skill:${primaryPath}`) é a mesma da página de detalhe, então fixar
// pelo tile reflete no switcher e no detalhe.
export function useDocEntityPin({
	kind,
	primaryPath,
	meta,
}: {
	kind: "skill" | "agent";
	primaryPath: string;
	meta: Pick<DocSessionMeta, "title" | "icon" | "iconColor" | "nav">;
}) {
	const key = docSessionKey({ kind, variantPath: primaryPath });
	const pinned = useDocSessionsStore((s) => s.recents.find((r) => r.key === key)?.pinned ?? false);
	const recordVisit = useDocSessionsStore((s) => s.recordVisit);
	const togglePinInStore = useDocSessionsStore((s) => s.togglePin);

	const togglePin = useCallback(() => {
		// Fixar algo nunca visitado: grava primeiro, senão o togglePin não acha a entrada e vira no-op.
		const exists = useDocSessionsStore.getState().recents.some((r) => r.key === key);
		if (!exists) {
			recordVisit({ key, kind, ...meta });
		}
		togglePinInStore(key);
	}, [key, kind, meta, recordVisit, togglePinInStore]);

	return { pinned, togglePin };
}

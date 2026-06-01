import { useCallback, useEffect } from "react";

import { type DocSessionMeta, useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

type DocSessionInput = Omit<DocSessionMeta, "lastVisited" | "pinned">;

// Só grava no MRU quem ficou na página por este tempo — passagens rápidas (abrir errado e voltar)
// não entopem o switcher. Fixar manualmente (toggle) grava na hora, ignorando o dwell.
const DWELL_MS = 10_000;

// Liga uma página de doc ao switcher de sessões. Duas coisas, com tempos diferentes:
//   1. `currentKey` é marcada IMEDIATAMENTE (o switcher filtra "o doc atual" da lista).
//   2. a entrada no MRU só é gravada após o dwell — ou na hora, se o usuário fixar.
// As páginas passam `meta` só quando os dados de título carregaram (`null` antes), pra não gravar
// rótulos em branco. Retorna o estado/ação de fixar pra toolbar oferecer o botão.
export function useRecordDocSession(meta: DocSessionInput | null) {
	const recordVisit = useDocSessionsStore((s) => s.recordVisit);
	const togglePinInStore = useDocSessionsStore((s) => s.togglePin);
	const setCurrentKey = useDocSwitcherStore((s) => s.setCurrentKey);

	const key = meta?.key ?? null;
	const pinned = useDocSessionsStore((s) =>
		key ? (s.recents.find((r) => r.key === key)?.pinned ?? false) : false,
	);

	useEffect(() => {
		if (!meta) {
			return;
		}
		setCurrentKey(meta.key);
		const timer = setTimeout(() => recordVisit(meta), DWELL_MS);
		return () => {
			clearTimeout(timer);
			setCurrentKey(null);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: re-arma só quando a sessão muda.
	}, [key, recordVisit, setCurrentKey]);

	const togglePin = useCallback(() => {
		if (!meta) {
			return;
		}
		// Fixar algo ainda não gravado (visita < 10s): grava primeiro, depois alterna o pin.
		const exists = useDocSessionsStore.getState().recents.some((r) => r.key === meta.key);
		if (!exists) {
			recordVisit(meta);
		}
		togglePinInStore(meta.key);
	}, [meta, recordVisit, togglePinInStore]);

	return { pinned, togglePin };
}

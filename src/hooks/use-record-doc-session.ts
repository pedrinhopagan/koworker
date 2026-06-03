import { useCallback, useEffect, useRef } from "react";

import { type DocSessionMeta, useDocSessionsStore } from "@/stores/doc-sessions";
import { useDocSwitcherStore } from "@/stores/doc-switcher";

type DocSessionInput = Omit<DocSessionMeta, "lastVisited" | "pinned">;

// Só grava no MRU quem ficou na página por este tempo — passagens rápidas (abrir errado e voltar)
// não entopem o switcher. Fixar manualmente (toggle) grava na hora, ignorando o dwell.
const DWELL_MS = 10_000;
// Tarefa concluída vale menos no switcher: demora o dobro pra grudar no MRU ao revisitar.
const DWELL_MS_DONE = 20_000;

// Liga uma página de doc ao switcher de sessões. Duas coisas, com tempos diferentes:
//   1. a sessão atual (`current`) é marcada IMEDIATAMENTE: o switcher a mostra como card "Sessão
//      atual" e começa a seleção do teclado no doc anterior.
//   2. a entrada no MRU só é gravada após o dwell — ou na hora, se o usuário fixar.
// As páginas passam `meta` só quando os dados de título carregaram (`null` antes), pra não gravar
// rótulos em branco. Retorna o estado/ação de fixar pra toolbar oferecer o botão.
export function useRecordDocSession(
	meta: DocSessionInput | null,
	options?: { completed?: boolean },
) {
	const recordVisit = useDocSessionsStore((s) => s.recordVisit);
	const togglePinInStore = useDocSessionsStore((s) => s.togglePin);
	const setCurrent = useDocSwitcherStore((s) => s.setCurrent);

	const key = meta?.key ?? null;
	const completed = options?.completed ?? false;
	const pinned = useDocSessionsStore((s) =>
		key ? (s.recents.find((r) => r.key === key)?.pinned ?? false) : false,
	);

	// `done` significa dois momentos opostos: abrir uma tarefa já concluída (revisitar — grava em 20s)
	// vs concluí-la enquanto se está nela. No segundo caso o `setDone` fecha a sessão e ela deve ficar
	// fechada nesta visita — sem re-armar o timer, senão o dwell a re-gravaria. Estes refs separam os
	// dois: a transição false→true sem trocar de doc é "concluiu vendo".
	const prevKeyRef = useRef<string | null>(null);
	const prevCompletedRef = useRef(false);

	useEffect(() => {
		if (!meta) {
			return;
		}

		const sameSession = prevKeyRef.current === meta.key;
		const justCompleted = sameSession && completed && !prevCompletedRef.current;
		prevKeyRef.current = meta.key;
		prevCompletedRef.current = completed;

		// Concluir vendo: a sessão é fechada, não re-gravada — o dwell não re-arma.
		if (justCompleted) {
			setCurrent(meta);
			return () => setCurrent(null);
		}

		const dwell = completed ? DWELL_MS_DONE : DWELL_MS;
		setCurrent(meta);
		const timer = setTimeout(() => recordVisit(meta), dwell);
		return () => {
			clearTimeout(timer);
			setCurrent(null);
		};
		// biome-ignore lint/correctness/useExhaustiveDependencies: re-avalia ao trocar de doc ou concluir.
	}, [key, completed, recordVisit, setCurrent]);

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

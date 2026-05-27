import { type RefObject, useEffect, useRef } from "react";

// Dispara quando um pointerdown acontece fora do elemento. `ignoreSelector` cobre conteúdo
// que vive em portal (ex.: o dropdown do select, renderizado fora da árvore do ref) para
// que interagir com ele não conte como "clique fora".
export function useClickOutside(
	ref: RefObject<HTMLElement | null>,
	onOutside: () => void,
	{ enabled, ignoreSelector }: { enabled: boolean; ignoreSelector?: string },
): void {
	const callback = useRef(onOutside);
	callback.current = onOutside;

	useEffect(() => {
		if (!enabled) return;

		function handle(event: PointerEvent) {
			const target = event.target;
			if (!(target instanceof HTMLElement)) return;
			if (ref.current?.contains(target)) return;
			if (ignoreSelector && target.closest(ignoreSelector)) return;
			callback.current();
		}

		document.addEventListener("pointerdown", handle);
		return () => document.removeEventListener("pointerdown", handle);
	}, [ref, enabled, ignoreSelector]);
}

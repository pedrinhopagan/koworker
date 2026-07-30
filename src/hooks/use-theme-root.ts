import { useEffect, useState } from "react";

export function useThemeRootContainer(): HTMLElement | null {
	const [container, setContainer] = useState<HTMLElement | null>(null);

	useEffect(() => {
		if (container) return;
		setContainer(document.querySelector<HTMLElement>("[data-theme-root]"));
	}, [container]);

	return container;
}

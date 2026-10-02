import { useEffect } from "react";

export function useVisualViewport() {
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) {
			return;
		}
		const root = document.documentElement;
		function update() {
			if (!viewport || viewport.scale !== 1) {
				return;
			}
			root.style.setProperty("--app-viewport-height", `${viewport.height}px`);
			root.style.setProperty("--app-viewport-top", `${viewport.offsetTop}px`);
		}
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			root.style.removeProperty("--app-viewport-height");
			root.style.removeProperty("--app-viewport-top");
		};
	}, []);
}

import { useEffect } from "react";

export function useVisualViewport() {
	useEffect(() => {
		const viewport = window.visualViewport;
		if (!viewport) {
			return;
		}
		const root = document.documentElement;
		let idleHeight = window.innerHeight;
		let width = window.innerWidth;
		function update() {
			if (!viewport || viewport.scale !== 1) {
				return;
			}
			root.style.setProperty("--app-viewport-height", `${viewport.height}px`);
			root.style.setProperty("--app-viewport-top", `${viewport.offsetTop}px`);
			const editing =
				document.activeElement instanceof HTMLElement &&
				!!document.activeElement.closest('input, textarea, [contenteditable="true"]');
			if (!editing || width !== window.innerWidth) {
				idleHeight = window.innerHeight;
				width = window.innerWidth;
			}
			root.dataset.keyboardOpen = String(
				editing && Math.max(idleHeight, window.innerHeight) - viewport.height > 120,
			);
		}
		update();
		viewport.addEventListener("resize", update);
		viewport.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		document.addEventListener("focusin", update);
		document.addEventListener("focusout", update);
		return () => {
			viewport.removeEventListener("resize", update);
			viewport.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			document.removeEventListener("focusin", update);
			document.removeEventListener("focusout", update);
			delete root.dataset.keyboardOpen;
			root.style.removeProperty("--app-viewport-height");
			root.style.removeProperty("--app-viewport-top");
		};
	}, []);
}

import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/terminal/store";

type TerminalMountProps = {
	taskId: string;
	className?: string;
	visible: boolean;
};

export function TerminalMount({ taskId, className, visible }: TerminalMountProps) {
	const ref = useRef<HTMLDivElement | null>(null);
	const setSlot = useTerminalStore((state) => state.setSlot);
	const clearSlot = useTerminalStore((state) => state.clearSlot);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		let raf = 0;
		const update = () => {
			cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				const rect = el.getBoundingClientRect();
				const isVisible = visible && rect.width > 4 && rect.height > 4;
				setSlot(taskId, {
					top: rect.top,
					left: rect.left,
					width: rect.width,
					height: rect.height,
					visible: isVisible,
				});
			});
		};

		const ro = new ResizeObserver(update);
		ro.observe(el);
		update();

		const onScroll = () => update();
		window.addEventListener("scroll", onScroll, true);
		window.addEventListener("resize", onScroll);

		return () => {
			cancelAnimationFrame(raf);
			ro.disconnect();
			window.removeEventListener("scroll", onScroll, true);
			window.removeEventListener("resize", onScroll);
			clearSlot(taskId);
		};
	}, [taskId, visible, setSlot, clearSlot]);

	return <div ref={ref} className={cn("h-full w-full", className)} />;
}

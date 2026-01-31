import { useMemo } from "react";

import { Terminal } from "@/components/terminal/Terminal";
import { useTerminalStore } from "@/terminal/store";
import { cn } from "@/lib/utils";

export function TerminalManager() {
	const sessions = useTerminalStore((state) => state.sessionsByTask);
	const slots = useTerminalStore((state) => state.slotsByTask);
	const clearSession = useTerminalStore((state) => state.clearSession);

	const sessionList = useMemo(() => Object.values(sessions), [sessions]);

	return (
		<>
			{sessionList.map((session) => {
				const slot = slots[session.taskId];
				const isVisible = Boolean(slot?.visible);
				const style = isVisible
					? {
							position: "fixed" as const,
							top: slot.top,
							left: slot.left,
							width: slot.width,
							height: slot.height,
							zIndex: 40,
					  }
					: {
							position: "fixed" as const,
							top: 0,
							left: -10000,
							width: 920,
							height: 520,
							pointerEvents: "none" as const,
					  };

				return (
					<div key={session.sessionId} style={style} className={cn(!isVisible && "opacity-0")}>
						<Terminal
							sessionId={session.sessionId}
							sessionLabel={session.tmuxSession}
							className={cn("h-full")}
							isVisible={isVisible}
							onExit={() => clearSession(session.taskId)}
						/>
					</div>
				);
			})}
		</>
	);
}

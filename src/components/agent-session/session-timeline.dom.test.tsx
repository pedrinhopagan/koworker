import { expect, test } from "bun:test";

import { get, slot } from "../../../tests/web/dom";
import { cleanup, fireEvent, render } from "../../../tests/web/testing-library";
import type { AgentSessionEvent } from "@/lib/agent-session";
import { SessionTimeline } from "./session-timeline";

test("histórico cresce em lotes e eventos novos não removem o começo que está sendo lido", async () => {
	const events: AgentSessionEvent[] = Array.from({ length: 100 }, (_, seq) => ({
		id: String(seq),
		sessionId: "pane",
		seq,
		at: seq,
		payload: { kind: "notice", label: `Marco ${seq}`, tone: "info" },
	}));
	const view = render(<SessionTimeline events={events.slice(0, 99)} busy={false} />);
	try {
		expect(get("session-timeline").dataset.hiddenCount).toBe("69");
		view.rerender(<SessionTimeline events={events} busy={false} />);
		expect(get("session-timeline").dataset.hiddenCount).toBe("69");
		expect(get("session-timeline").dataset.visibleCount).toBe("31");
		fireEvent.click(slot(get("session-timeline"), "load-previous"));
		expect(get("session-timeline").dataset.hiddenCount).toBe("39");
		expect(get("session-timeline").dataset.visibleCount).toBe("61");
	} finally {
		await cleanup();
	}
});

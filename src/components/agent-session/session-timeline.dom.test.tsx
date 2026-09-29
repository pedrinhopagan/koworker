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

test("linha de pensamento mostra os passos com busy e colapsa em 'Pensou por' ao terminar", async () => {
	const events: AgentSessionEvent[] = [
		{ id: "u", sessionId: "s", seq: 0, at: Date.now(), payload: { kind: "user", text: "vai" } },
		{
			id: "t",
			sessionId: "s",
			seq: 1,
			at: Date.now(),
			payload: {
				kind: "tool_use",
				name: "Read",
				label: "Leitura",
				detail: "a.ts",
				status: "running",
			},
		},
	];
	const view = render(<SessionTimeline events={events} busy={false} />);
	try {
		expect(document.querySelector("[data-component='thought-line']")).toBeNull();
		view.rerender(<SessionTimeline events={events} busy />);
		const line = get("thought-line");
		expect(line.dataset.working).toBe("true");
		expect(line.textContent).toContain("Trabalhando");
		expect(line.textContent).toContain("Leitura");
		view.rerender(<SessionTimeline events={events} busy={false} />);
		expect(get("thought-line").dataset.working).toBeUndefined();
		expect(get("thought-line").textContent).toContain("Pensou por");
		expect(get("thought-line").querySelector("button")?.getAttribute("aria-expanded")).toBe(
			"false",
		);
	} finally {
		await cleanup();
	}
});

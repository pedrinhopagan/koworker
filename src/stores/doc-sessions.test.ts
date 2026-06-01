import { beforeEach, describe, expect, it } from "bun:test";

import { type DocSessionMeta, docSessionKey, useDocSessionsStore } from "./doc-sessions";

describe("docSessionKey", () => {
	it("deriva chaves distintas por superfície", () => {
		expect(docSessionKey({ kind: "task", taskId: "abc", file: "plan.md" })).toBe(
			"task:abc:plan.md",
		);
		expect(docSessionKey({ kind: "vault", projectId: "p1", fileName: "notes.md" })).toBe(
			"vault:p1:notes.md",
		);
		expect(docSessionKey({ kind: "docs", projectId: "p1", path: "guia/intro.md" })).toBe(
			"docs:p1:guia/intro.md",
		);
		expect(docSessionKey({ kind: "skill", projectName: "kw", variantPath: "/a/SKILL.md" })).toBe(
			"skill:kw:/a/SKILL.md",
		);
	});
});

function visit(key: string): Omit<DocSessionMeta, "lastVisited"> {
	return { key, kind: "task", title: key, nav: { to: "/tarefas/$taskId/$file", params: {} } };
}

describe("recordVisit (MRU)", () => {
	beforeEach(() => {
		useDocSessionsStore.setState({ recents: [] });
	});

	it("coloca a visita mais recente no topo", () => {
		const { recordVisit } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		recordVisit(visit("b"));

		expect(useDocSessionsStore.getState().recents.map((r) => r.key)).toEqual(["b", "a"]);
	});

	it("revisitar move pro topo sem duplicar", () => {
		const { recordVisit } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		recordVisit(visit("b"));
		recordVisit(visit("a"));

		expect(useDocSessionsStore.getState().recents.map((r) => r.key)).toEqual(["a", "b"]);
	});

	it("limita o tamanho da lista a 12", () => {
		const { recordVisit } = useDocSessionsStore.getState();
		for (let i = 0; i < 20; i++) {
			recordVisit(visit(`k${i}`));
		}

		const recents = useDocSessionsStore.getState().recents;
		expect(recents).toHaveLength(12);
		expect(recents[0].key).toBe("k19");
	});

	it("carimba lastVisited", () => {
		useDocSessionsStore.getState().recordVisit(visit("a"));
		expect(useDocSessionsStore.getState().recents[0].lastVisited).toBeGreaterThan(0);
	});

	it("preserva o pin ao revisitar (dwell não desfixa)", () => {
		const { recordVisit, togglePin } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		togglePin("a");
		recordVisit(visit("a"));

		expect(useDocSessionsStore.getState().recents[0].pinned).toBe(true);
	});

	it("o teto descarta só as não-fixadas; fixadas sobrevivem além de 12", () => {
		const { recordVisit, togglePin } = useDocSessionsStore.getState();
		recordVisit(visit("pin"));
		togglePin("pin");
		for (let i = 0; i < 20; i++) {
			recordVisit(visit(`k${i}`));
		}

		const recents = useDocSessionsStore.getState().recents;
		expect(recents).toHaveLength(12);
		expect(recents.some((r) => r.key === "pin")).toBe(true);
		expect(recents.filter((r) => r.pinned)).toHaveLength(1);
	});
});

describe("togglePin / removeRecent / clearLoose", () => {
	beforeEach(() => {
		useDocSessionsStore.setState({ recents: [] });
	});

	it("togglePin alterna o estado fixado", () => {
		const { recordVisit, togglePin } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		togglePin("a");
		expect(useDocSessionsStore.getState().recents[0].pinned).toBe(true);
		togglePin("a");
		expect(useDocSessionsStore.getState().recents[0].pinned).toBe(false);
	});

	it("removeRecent tira a entrada (fixada ou não)", () => {
		const { recordVisit, togglePin, removeRecent } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		recordVisit(visit("b"));
		togglePin("a");
		removeRecent("a");

		expect(useDocSessionsStore.getState().recents.map((r) => r.key)).toEqual(["b"]);
	});

	it("clearLoose remove só as não-fixadas", () => {
		const { recordVisit, togglePin, clearLoose } = useDocSessionsStore.getState();
		recordVisit(visit("a"));
		recordVisit(visit("b"));
		recordVisit(visit("c"));
		togglePin("b");
		clearLoose();

		expect(useDocSessionsStore.getState().recents.map((r) => r.key)).toEqual(["b"]);
	});
});

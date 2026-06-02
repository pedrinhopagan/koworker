import { beforeEach, describe, expect, it } from "bun:test";

import {
	type DocSessionMeta,
	docSessionKey,
	groupSessions,
	initialSwitcherIndex,
	useDocSessionsStore,
} from "./doc-sessions";

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

function meta(over: Partial<DocSessionMeta> & { key: string }): DocSessionMeta {
	return {
		kind: "task",
		title: over.key,
		nav: { to: "/", params: {} },
		lastVisited: 0,
		...over,
	};
}

describe("groupSessions", () => {
	it("agrupa por projeto e, dentro, junta os arquivos da mesma tarefa", () => {
		const list = [
			meta({ key: "task:t1:plan.md", title: "Tarefa 1", subtitle: "plan.md", projectName: "P" }),
			meta({ key: "task:t1:index.md", title: "Tarefa 1", subtitle: "index.md", projectName: "P" }),
			meta({ key: "vault:p:notes.md", kind: "vault", title: "Notas", projectName: "P" }),
		];

		const { groups } = groupSessions(list, null);

		expect(groups).toHaveLength(1);
		expect(groups[0].projectName).toBe("P");
		expect(groups[0].blocks[0]).toMatchObject({ type: "task", taskId: "t1" });
		expect(
			groups[0].blocks[0].type === "task" && groups[0].blocks[0].cards.map((c) => c.key),
		).toEqual(["task:t1:plan.md", "task:t1:index.md"]);
		expect(groups[0].blocks[1]).toMatchObject({ type: "doc" });
	});

	it("preserva a ordem de recência: projeto e tarefa mais recentes no topo", () => {
		const list = [
			meta({ key: "task:b:x.md", title: "B", projectName: "Proj B" }),
			meta({ key: "task:a:x.md", title: "A", projectName: "Proj A" }),
		];

		const { groups, cards } = groupSessions(list, null);

		expect(groups.map((g) => g.projectName)).toEqual(["Proj B", "Proj A"]);
		expect(cards.map((c) => c.key)).toEqual(["task:b:x.md", "task:a:x.md"]);
	});

	it("marca isCurrent na chave atual; entradas sem projeto caem num grupo próprio", () => {
		const list = [
			meta({ key: "task:t1:plan.md", projectName: "P" }),
			meta({ key: "skill:kw:/a/SKILL.md", kind: "skill" }),
		];

		const { groups, cards } = groupSessions(list, "task:t1:plan.md");

		expect(cards.find((c) => c.key === "task:t1:plan.md")?.isCurrent).toBe(true);
		expect(cards.find((c) => c.key === "skill:kw:/a/SKILL.md")?.isCurrent).toBe(false);
		expect(groups.at(-1)?.projectName).toBeNull();
	});
});

describe("initialSwitcherIndex", () => {
	it("aponta pro doc anterior do MRU, não pro card que o agrupamento põe antes", () => {
		// MRU: atual e "antigo" são do mesmo projeto P (tarefas diferentes); "anterior" é do projeto Q.
		// O agrupamento junta P (atual + antigo) antes de Q, então a ordem achatada vira
		// [atual, antigo, anterior] — mas o "anterior" do Alt+Tab é o 1º não-atual do MRU.
		const list = [
			meta({ key: "task:a:x.md", title: "A", projectName: "P" }),
			meta({ key: "vault:q:n.md", kind: "vault", title: "Anterior", projectName: "Q" }),
			meta({ key: "task:b:x.md", title: "B", projectName: "P" }),
		];

		const { cards } = groupSessions(list, "task:a:x.md");
		expect(cards.map((c) => c.key)).toEqual(["task:a:x.md", "task:b:x.md", "vault:q:n.md"]);
		expect(initialSwitcherIndex(list, "task:a:x.md")).toBe(2);
		expect(cards[2].key).toBe("vault:q:n.md");
	});

	it("sem sessão atual, começa no primeiro card", () => {
		const list = [meta({ key: "task:a:x.md", projectName: "P" })];
		expect(initialSwitcherIndex(list, null)).toBe(0);
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

	it("removeRecentsByPrefix tira todas as sessões da tarefa (uma por arquivo)", () => {
		const { recordVisit, removeRecentsByPrefix } = useDocSessionsStore.getState();
		recordVisit(visit("task:t1:plan.md"));
		recordVisit(visit("task:t1:notes.md"));
		recordVisit(visit("task:t2:plan.md"));
		removeRecentsByPrefix("task:t1:");

		expect(useDocSessionsStore.getState().recents.map((r) => r.key)).toEqual(["task:t2:plan.md"]);
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

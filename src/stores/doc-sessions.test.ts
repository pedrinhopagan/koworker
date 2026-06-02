import { beforeEach, describe, expect, it } from "bun:test";

import {
	blockStartIndices,
	distinctCards,
	type DocSessionMeta,
	docSessionKey,
	groupSessions,
	initialSwitcherIndex,
	jumpToBlock,
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
		expect(docSessionKey({ kind: "skill", variantPath: "/a/SKILL.md" })).toBe("skill:/a/SKILL.md");
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
		expect(groups[0].blocks[1]).toMatchObject({ type: "kind", kind: "vault" });
	});

	it("colapsa cards soltos não-contíguos do mesmo kind numa caixa, na posição do primeiro", () => {
		// MRU: vault, tarefa, vault — os dois vault não são contíguos. A caixa "vault" colapsa ambos na
		// posição do primeiro, então o achatado vira [vaultA, vaultB, taskX]: o vaultB sobe pra caixa.
		const list = [
			meta({ key: "vault:p:a.md", kind: "vault", title: "Vault A", projectName: "P" }),
			meta({ key: "task:x:plan.md", title: "Tarefa X", projectName: "P" }),
			meta({ key: "vault:p:b.md", kind: "vault", title: "Vault B", projectName: "P" }),
		];

		const { groups, cards } = groupSessions(list, "vault:p:a.md");

		expect(groups).toHaveLength(1);
		expect(groups[0].blocks[0]).toMatchObject({ type: "kind", kind: "vault" });
		expect(
			groups[0].blocks[0].type === "kind" && groups[0].blocks[0].cards.map((c) => c.key),
		).toEqual(["vault:p:a.md", "vault:p:b.md"]);
		expect(groups[0].blocks[1]).toMatchObject({ type: "task", taskId: "x" });
		expect(cards.map((c) => c.key)).toEqual(["vault:p:a.md", "vault:p:b.md", "task:x:plan.md"]);
		// O anterior (1º não-atual do MRU) é a tarefa; initialSwitcherIndex o acha por chave apesar do
		// reorder do achatamento.
		expect(initialSwitcherIndex(list, "vault:p:a.md")).toBe(2);
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

	it("duplica o fixado na seção Fixadas e no grupo, com flatIndex distinto por ocorrência", () => {
		const list = [
			meta({ key: "task:t1:plan.md", title: "Tarefa 1", projectName: "P", pinned: true }),
			meta({ key: "vault:p:notes.md", kind: "vault", title: "Notas", projectName: "P" }),
		];

		const { pinned, groups, cards } = groupSessions(list, null);

		// Fixadas: flat, só o fixado, no topo.
		expect(pinned.map((c) => c.key)).toEqual(["task:t1:plan.md"]);
		// O grupo ainda tem a tarefa (não move) + a caixa de vault.
		expect(groups[0].blocks[0]).toMatchObject({ type: "task", taskId: "t1" });
		// A chave do fixado entra duas vezes no achatado; cada ocorrência tem seu flatIndex = posição.
		expect(cards.map((c) => c.key)).toEqual([
			"task:t1:plan.md",
			"task:t1:plan.md",
			"vault:p:notes.md",
		]);
		expect(cards.map((c) => c.flatIndex)).toEqual([0, 1, 2]);
		// A 1ª ocorrência (canônica pra findIndex-por-chave) é a de Fixadas.
		expect(cards.findIndex((c) => c.key === "task:t1:plan.md")).toBe(0);
	});

	it("sem fixados, a seção Fixadas é vazia e o achatado não duplica", () => {
		const list = [meta({ key: "vault:p:n.md", kind: "vault", projectName: "P" })];
		const { pinned, cards } = groupSessions(list, null);

		expect(pinned).toHaveLength(0);
		expect(cards.map((c) => c.key)).toEqual(["vault:p:n.md"]);
	});

	it("marca isCurrent na chave atual; entradas sem projeto caem num grupo próprio", () => {
		const list = [
			meta({ key: "task:t1:plan.md", projectName: "P" }),
			meta({ key: "vault:x:n.md", kind: "vault" }),
		];

		const { groups, cards } = groupSessions(list, "task:t1:plan.md");

		expect(cards.find((c) => c.key === "task:t1:plan.md")?.isCurrent).toBe(true);
		expect(cards.find((c) => c.key === "vault:x:n.md")?.isCurrent).toBe(false);
		expect(groups.at(-1)?.projectName).toBeNull();
	});
});

describe("seção Skills (global, deduplicada)", () => {
	it("tira skills dos grupos pra seção própria e deduplica por slug", () => {
		// A mesma skill (slug "boa-noite") visitada sob dois projetos deixou chaves distintas no MRU.
		const list = [
			meta({
				key: "skill:/x/SKILL.md",
				kind: "skill",
				title: "boa-noite",
				projectName: "P",
				nav: { to: "/skills/$slug", params: { slug: "boa-noite" } },
			}),
			meta({ key: "task:t1:plan.md", title: "T1", projectName: "P" }),
			meta({
				key: "skill:/y/SKILL.md",
				kind: "skill",
				title: "boa-noite",
				projectName: "Q",
				nav: { to: "/skills/$slug", params: { slug: "boa-noite" } },
			}),
		];

		const { skills, groups, cards } = groupSessions(list, null);

		// Uma só skill (1ª ocorrência = mais recente), fora de qualquer grupo de projeto.
		expect(skills.map((c) => c.key)).toEqual(["skill:/x/SKILL.md"]);
		expect(
			groups.every((g) => g.blocks.every((b) => b.type !== "kind" || b.kind !== "skill")),
		).toBe(true);
		// Achatado = grupos primeiro, Skills no fim.
		expect(cards.map((c) => c.key)).toEqual(["task:t1:plan.md", "skill:/x/SKILL.md"]);
	});

	it("blockStartIndices inclui o bloco de Skills no fim", () => {
		const list = [
			meta({ key: "task:t1:plan.md", title: "T1", projectName: "P" }),
			meta({
				key: "skill:/x",
				kind: "skill",
				title: "S",
				nav: { to: "/skills/$slug", params: { slug: "s" } },
			}),
		];

		// cards: [task@0, skill@1] → starts [0 (tarefa), 1 (Skills)]
		expect(blockStartIndices(list, null)).toEqual([0, 1]);
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

describe("navegação por caixas (blockStartIndices / jumpToBlock / distinctCards)", () => {
	// Fixadas(plan) · P[tarefa t1: plan, index][vault: n] · Q[docs: d]
	// achatado: [plan@0(fixada), plan@1, index@2, vault-n@3, docs-d@4]  → starts [0,1,3,4]
	const list = [
		meta({ key: "task:t1:plan.md", title: "T1", projectName: "P", pinned: true }),
		meta({ key: "task:t1:index.md", title: "T1", projectName: "P" }),
		meta({ key: "vault:p:n.md", kind: "vault", title: "N", projectName: "P" }),
		meta({ key: "docs:q:d.md", kind: "docs", title: "D", projectName: "Q" }),
	];

	it("blockStartIndices marca o começo de Fixadas e de cada bloco", () => {
		expect(blockStartIndices(list, null)).toEqual([0, 1, 3, 4]);
	});

	it("jumpToBlock pula pra caixa vizinha e clampa nas pontas", () => {
		const starts = blockStartIndices(list, null);
		// de Fixadas (0) pra baixo → começo da tarefa (1)
		expect(jumpToBlock(starts, 0, 1)).toBe(1);
		// de dentro da tarefa (2) pra baixo → caixa vault (3); pra cima → Fixadas (0)
		expect(jumpToBlock(starts, 2, 1)).toBe(3);
		expect(jumpToBlock(starts, 2, -1)).toBe(0);
		// clamp: topo não passa de 0, fundo não passa da última caixa (4)
		expect(jumpToBlock(starts, 0, -1)).toBe(0);
		expect(jumpToBlock(starts, 4, 1)).toBe(4);
	});

	it("distinctCards dedupa por chave e aponta o dígito pra 1ª ocorrência (a fixada)", () => {
		const { cards } = groupSessions(list, null);
		const distinct = distinctCards(cards);

		expect(distinct.map((c) => c.key)).toEqual([
			"task:t1:plan.md",
			"task:t1:index.md",
			"vault:p:n.md",
			"docs:q:d.md",
		]);
		// o "1" leva ao flatIndex 0 — a ocorrência de Fixadas, não a do grupo (flatIndex 1).
		expect(distinct[0].flatIndex).toBe(0);
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

import { beforeEach, describe, expect, it } from "bun:test";

import { docSessionKey, useDocSessionsStore } from "./doc-sessions";

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
		expect(docSessionKey({ kind: "agent", variantPath: "/a/x.md" })).toBe("agent:/a/x.md");
	});
});

describe("âncoras de leitura", () => {
	beforeEach(() => {
		useDocSessionsStore.setState({ anchors: {} });
	});

	it("devolve a posição salva para o mesmo documento", () => {
		const key = docSessionKey({ kind: "task", taskId: "abc", file: "plan.md" });
		const anchor = { headingText: "Fase 2", level: 2, occurrence: 1, offsetPx: 40 };

		useDocSessionsStore.getState().saveAnchor(key, anchor);

		expect(useDocSessionsStore.getState().getAnchor(key)).toEqual(anchor);
		expect(useDocSessionsStore.getState().getAnchor("task:abc:outro.md")).toBeNull();
	});

	it("mantém as 200 âncoras mais recentes", () => {
		const { saveAnchor } = useDocSessionsStore.getState();
		for (let index = 0; index < 201; index++) {
			saveAnchor(`vault:p:${index}.md`, {
				headingText: null,
				level: 1,
				occurrence: 1,
				offsetPx: index,
			});
		}

		expect(useDocSessionsStore.getState().getAnchor("vault:p:0.md")).toBeNull();
		expect(useDocSessionsStore.getState().getAnchor("vault:p:200.md")?.offsetPx).toBe(200);
	});
});

import { expect, test } from "bun:test";

import { buildSlashItems, searchSlashItems } from "@/lib/slash-menu";
import type { TaskSkill } from "@/types/skills";

function skill(slug: string, label: string, description = ""): TaskSkill {
	return {
		id: slug,
		slug,
		label,
		description,
		findings: [],
		icon: "FolderOpen",
		color: "#000000",
		categoryId: null,
		quickInvoke: false,
		sources: [],
		conflict: false,
		primaryPath: "",
		primaryDir: "",
		metadata: {},
		requiresSubtaskSelection: false,
	};
}

test("no início do input mistura comandos da CLI com as skills", () => {
	const items = buildSlashItems({
		skills: [skill("commit", "Comitar")],
		cli: "claude",
		atStart: true,
	});

	expect(items.some((item) => item.kind === "command" && item.name === "clear")).toBe(true);
	expect(items.some((item) => item.kind === "skill" && item.name === "commit")).toBe(true);
});

test("no meio do input só as skills aparecem", () => {
	const items = buildSlashItems({
		skills: [skill("commit", "Comitar")],
		cli: "claude",
		atStart: false,
	});

	expect(items.every((item) => item.kind === "skill")).toBe(true);
});

test("o apelido de outra CLI encontra o comando equivalente", () => {
	const claude = searchSlashItems(
		buildSlashItems({ skills: [], cli: "claude", atStart: true }),
		"new",
	);
	const codex = searchSlashItems(
		buildSlashItems({ skills: [], cli: "codex", atStart: true }),
		"clear",
	);

	expect(claude[0]?.name).toBe("clear");
	expect(codex[0]?.name).toBe("new");
});

test("o comando vem antes da skill que só casa pela descrição", () => {
	const items = buildSlashItems({
		skills: [skill("entregar", "Entregar", "limpa o contexto e recomeça")],
		cli: "claude",
		atStart: true,
	});

	expect(searchSlashItems(items, "limpa")[0]?.name).toBe("clear");
});

test("CLI desconhecida não oferece comando algum", () => {
	const items = buildSlashItems({ skills: [], cli: "opencode", atStart: true });

	expect(items).toEqual([]);
});

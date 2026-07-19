import { expect, test } from "bun:test";

import { searchSkills } from "@/lib/skill-search";
import type { TaskSkill } from "@/types/skills";

function skill(slug: string, label: string, description = ""): TaskSkill {
	return {
		id: slug,
		slug,
		label,
		description,
		instructions: "",
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

test("prioriza correspondências no título antes de slug e descrição", () => {
	const skills = [
		skill("deploy", "Publicar", "Executa uma revisão"),
		skill("review", "Auditar código"),
		skill("code-review", "Completar revisão"),
		skill("review-plan", "Revisar plano"),
	];

	expect(searchSkills(skills, "revi").map((item) => item.slug)).toEqual([
		"review-plan",
		"code-review",
		"review",
		"deploy",
	]);
});

test("prioriza título exato e preserva a ordem entre resultados equivalentes", () => {
	const skills = [
		skill("second", "Revisão diária"),
		skill("exact", "Revisão"),
		skill("first", "Revisão técnica"),
	];

	expect(searchSkills(skills, "revisão").map((item) => item.slug)).toEqual([
		"exact",
		"second",
		"first",
	]);
});

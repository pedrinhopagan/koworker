import { expect, test } from "bun:test";

import { createSkillSearch, normalizeSearchText, searchSkills } from "@/lib/skill-search";
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

test("prioriza correspondências no nome antes de descrição", () => {
	const skills = [
		skill("deploy", "Publicar", "Executa uma revisão"),
		skill("review", "Auditar código"),
		skill("code-review", "Completar revisão"),
		skill("review-plan", "Revisar plano"),
	];

	expect(searchSkills(skills, "revi").map((item) => item.slug)).toEqual([
		"review-plan",
		"review",
		"code-review",
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

test("slug exato vem antes de quem só contém o termo e o conteúdo fica por último", () => {
	const skills = [
		{ ...skill("prompt-review", "Prompt review"), content: "" },
		{ ...skill("deploy", "Publicar", "Abre um PR"), content: "" },
		{ ...skill("notas", "Notas"), content: "Depois rode /pr" },
		{ ...skill("pr", "Abrir pull request"), content: "" },
		{ ...skill("sprint", "Sprint"), content: "" },
	];

	expect(searchSkills(skills, "pr").map((item) => item.slug)).toEqual([
		"pr",
		"prompt-review",
		"sprint",
		"deploy",
		"notas",
	]);
});

test("ignora acentos ao comparar", () => {
	expect(searchSkills([skill("revisao", "Revisão")], "revisao")).toHaveLength(1);
});

test("exige todas as palavras, em qualquer ordem e campo", () => {
	const skills = [
		skill("pr", "Abrir pull request"),
		skill("pull", "Sincronizar remoto", "Faz pull do branch"),
	];

	expect(searchSkills(skills, "request pull").map((item) => item.slug)).toEqual(["pr"]);
});

test("junta palavras separadas por espaço com o slug hifenizado", () => {
	const skills = [skill("review-code", "Outra"), skill("code-review", "Revisão de código")];

	expect(searchSkills(skills, "code review").map((item) => item.slug)[0]).toBe("code-review");
});

test("aceita iniciais e um erro de digitação no nome", () => {
	const skills = [skill("code-review", "Code review"), skill("deploy", "Deploy")];

	expect(searchSkills(skills, "cr").map((item) => item.slug)).toEqual(["code-review"]);
	expect(searchSkills(skills, "deplyo").map((item) => item.slug)).toEqual(["deploy"]);
	expect(searchSkills(skills, "reveiw").map((item) => item.slug)).toEqual(["code-review"]);
});

test("normalização preserva o comprimento para destacar no texto original", () => {
	const value = "Ação Útil çÇ";
	expect(normalizeSearchText(value)).toBe("acao util cc");
	expect(normalizeSearchText(value)).toHaveLength(value.length);
});

test("devolve destaque no nome e trecho do conteúdo", () => {
	const hits = createSkillSearch([
		{
			...skill("notas", "Notas"),
			content: "Introdução longa.\n\nDepois rode o fluxo de Revisão final",
		},
	])("revisao");

	expect(hits[0]?.kind).toBe("content");
	const snippet = hits[0]?.snippet;
	expect(snippet).not.toBeNull();
	const [start, end] = snippet!.ranges[0]!;
	expect(snippet!.text.slice(start, end)).toBe("Revisão");
	expect(snippet!.text).not.toContain("\n");

	const named = createSkillSearch([skill("code-review", "Code Review")])("rev");
	expect(named[0]?.labelRanges).toEqual([[5, 8]]);
});

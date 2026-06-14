import { describe, expect, it } from "bun:test";
import { lintPrinciples } from "./lint";
import { type PrinciplesInput, RULES } from "./rules";

const RULE_BY_ID = new Map(RULES.map((rule) => [rule.id, rule]));

function rule(id: string) {
	const found = RULE_BY_ID.get(id);
	if (!found) {
		throw new Error(`Regra desconhecida: ${id}`);
	}

	return found;
}

function input(overrides: Partial<PrinciplesInput>): PrinciplesInput {
	return {
		kind: "skill",
		slug: "test-slug",
		name: "test-name",
		description: "Use when fixing the build.",
		body: "Run the build, then fix the first error.",
		metadata: {},
		...overrides,
	};
}

describe("generic-scaffolding-headers", () => {
	it("dispara para cabeçalho genérico", () => {
		expect(
			rule("generic-scaffolding-headers").check(input({ body: "## Overview\n\nDoes stuff." })),
		).toBe(true);
	});

	it("não dispara para cabeçalho com substância", () => {
		expect(
			rule("generic-scaffolding-headers").check(
				input({ body: "## Overview of the auth token rotation\n\nDoes stuff." }),
			),
		).toBe(false);
	});
});

describe("obvious-competence", () => {
	it("dispara para frase de competência óbvia", () => {
		expect(
			rule("obvious-competence").check(input({ body: "Leia primeiro o código antes de mexer." })),
		).toBe(true);
	});

	it("não dispara para corpo de regra concreta", () => {
		expect(
			rule("obvious-competence").check(
				input({ body: "Rode `bun test` e corrija o primeiro erro." }),
			),
		).toBe(false);
	});
});

describe("description-summarizes", () => {
	it("dispara para descrição longa sem gatilho", () => {
		const longNoTrigger =
			"Esta ferramenta processa registros financeiros, calcula impostos, " +
			"gera relatórios detalhados, exporta planilhas, concilia lançamentos " +
			"bancários e produz um sumário executivo mensal com gráficos coloridos " +
			"para a diretoria revisar em reuniões trimestrais formais, incluindo " +
			"projeções, indicadores de desempenho e recomendações estratégicas.";
		expect(longNoTrigger.length).toBeGreaterThan(280);
		expect(rule("description-summarizes").check(input({ description: longNoTrigger }))).toBe(true);
	});

	it("não dispara para descrição curta com gatilho", () => {
		expect(
			rule("description-summarizes").check(input({ description: "Use para corrigir o build." })),
		).toBe(false);
	});

	it("não dispara para descrição longa que tem pista de gatilho", () => {
		const longWithTrigger =
			"Use when você precisa processar registros financeiros, calcular " +
			"impostos, gerar relatórios detalhados, exportar planilhas, conciliar " +
			"lançamentos bancários e produzir um sumário executivo mensal completo " +
			"com gráficos coloridos para a diretoria revisar formalmente, incluindo " +
			"projeções, indicadores de desempenho e recomendações estratégicas.";
		expect(longWithTrigger.length).toBeGreaterThan(280);
		expect(rule("description-summarizes").check(input({ description: longWithTrigger }))).toBe(
			false,
		);
	});
});

describe("description-missing", () => {
	it("dispara para descrição só com espaços", () => {
		expect(rule("description-missing").check(input({ description: "   " }))).toBe(true);
	});

	it("não dispara para descrição preenchida", () => {
		expect(rule("description-missing").check(input({ description: "Use para X." }))).toBe(false);
	});
});

describe("unless-clauses", () => {
	it("dispara para cláusula de exceção no corpo", () => {
		expect(
			rule("unless-clauses").check(
				input({ body: "Sempre rode os testes, a menos que esteja com pressa." }),
			),
		).toBe(true);
	});

	it("não dispara para regra direta", () => {
		expect(
			rule("unless-clauses").check(input({ body: "Sempre rode os testes antes de commitar." })),
		).toBe(false);
	});
});

describe("not-brief", () => {
	it("dispara para corpo com muitas linhas", () => {
		const longBody = Array.from({ length: 250 }, (_, i) => `linha ${i} com conteúdo`).join("\n");
		expect(rule("not-brief").check(input({ body: longBody }))).toBe(true);
	});

	it("não dispara para corpo curto", () => {
		expect(
			rule("not-brief").check(input({ body: "Uma regra curta e direta.\n\nMais uma linha." })),
		).toBe(false);
	});
});

describe("conversational-justification", () => {
	it("dispara para justificativa conversacional", () => {
		expect(
			rule("conversational-justification").check(
				input({ body: "Use migrations. The reason is they keep history." }),
			),
		).toBe(true);
	});

	it("não dispara para contexto durável", () => {
		expect(
			rule("conversational-justification").check(input({ body: "Migrations versionam o schema." })),
		).toBe(false);
	});
});

describe("agent-missing-tools", () => {
	it("dispara quando tools está ausente", () => {
		expect(rule("agent-missing-tools").check(input({ kind: "agent", metadata: {} }))).toBe(true);
	});

	it("dispara quando tools é string vazia", () => {
		expect(
			rule("agent-missing-tools").check(input({ kind: "agent", metadata: { tools: "  " } })),
		).toBe(true);
	});

	it("não dispara quando tools está declarado", () => {
		expect(
			rule("agent-missing-tools").check(
				input({ kind: "agent", metadata: { tools: "Read, Edit" } }),
			),
		).toBe(false);
	});
});

describe("agent-output-standardization", () => {
	it("dispara quando o corpo padroniza a saída", () => {
		expect(
			rule("agent-output-standardization").check(
				input({ kind: "agent", body: "Responda no formato de saída JSON." }),
			),
		).toBe(true);
	});

	it("não dispara quando o corpo descreve o que faz", () => {
		expect(
			rule("agent-output-standardization").check(
				input({ kind: "agent", body: "Revisa o diff e aponta bugs." }),
			),
		).toBe(false);
	});
});

describe("lintPrinciples", () => {
	it("não roda regras de agent para uma skill", () => {
		const findings = lintPrinciples(
			input({ kind: "skill", metadata: {}, body: "Responda no formato de saída JSON." }),
		);
		const ids = findings.map((f) => f.ruleId);
		expect(ids).not.toContain("agent-missing-tools");
		expect(ids).not.toContain("agent-output-standardization");
	});

	it("roda regras de agent para um agent", () => {
		const findings = lintPrinciples(input({ kind: "agent", metadata: {} }));
		expect(findings.map((f) => f.ruleId)).toContain("agent-missing-tools");
	});

	it("devolve findings no formato esperado", () => {
		const findings = lintPrinciples(
			input({ kind: "skill", description: "   ", body: "## Overview\n\nx" }),
		);
		const missing = findings.find((f) => f.ruleId === "description-missing");

		expect(missing).toBeDefined();
		expect(missing?.severity).toBe("warn");
		expect(typeof missing?.title).toBe("string");
		expect(missing?.detail.length).toBeGreaterThan(0);
	});

	it("devolve lista vazia para entrada limpa", () => {
		const findings = lintPrinciples(
			input({
				kind: "skill",
				description: "Use para corrigir o build.",
				body: "Rode `bun test` e corrija o primeiro erro.",
			}),
		);
		expect(findings).toEqual([]);
	});
});

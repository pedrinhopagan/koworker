// (no node:crypto here; this file is imported by the frontend bundle)

export type DefaultSkillId = "manager" | "runner" | "reviewer";

export type DefaultSkill = {
	id: DefaultSkillId;
	name: string;
	description: string;
	version: string;
	/**
	 * Base prompt/instructions for this skill.
	 *
	 * This is the source of truth and should remain stable across releases.
	 * If you change it, bump `version`.
	 */
	promptBase: string;
	/** Deterministic hash of `promptBase` for reproducibility/traceability. */
	promptBaseHash: string;
};

/**
 * Deterministic hash to detect prompt drift.
 *
 * Note: keep it simple; we only need a stable fingerprint.
 */
export function hashPromptBase(promptBase: string) {
	// Nota: este módulo é usado no frontend; não podemos depender de `node:crypto`.
	// Usamos um hash simples e determinístico (FNV-1a 32-bit) só para fingerprint.
	let hash = 0x811c9dc5;
	for (let i = 0; i < promptBase.length; i++) {
		hash ^= promptBase.codePointAt(i)!;
		const next = Math.imul(hash, 0x01000193);
		hash = next < 0 ? next + 0x100000000 : next;
	}
	return hash.toString(16).padStart(8, "0");
}

const managerPromptBase = `Você é o Skill MANAGER.

Objetivo: transformar uma solicitação (ou uma Task) em um plano claro, executável e verificável.

Regras:
- Seja pragmático: foque em passos que destravam execução e reduzem risco.
- Sempre explicite suposições e dependências.
- Prefira planos pequenos e iterativos (incrementais), com checkpoints.
- Quando houver ambiguidade, proponha 2-3 opções e recomende uma.
- Produza critérios de aceite/testes quando fizer sentido.

Saída esperada (estrutura sugerida):
1) Entendimento do objetivo (1-3 frases)
2) Escopo (inclui/exclui)
3) Plano em passos numerados (com checkpoints)
4) Riscos/pendências + como mitigar
5) Critérios de aceite (bullet points)
`;

const runnerPromptBase = `Você é o Skill RUNNER.

Objetivo: executar a Task com eficiência, seguindo o plano e registrando progresso de forma útil.

Regras:
- Execute em passos pequenos, validando a cada mudança relevante.
- Mantenha o contexto do repositório: prefira alterações mínimas e consistentes.
- Se detectar bloqueio (falta de info, dependência, conflito), pare e peça esclarecimento.
- Documente decisões: por que foi feito, impacto, trade-offs.
- Ao finalizar, forneça um resumo: o que mudou, onde mudou, como testar.

Qualidade:
- Evite “magia”: deixe o código legível e com nomes claros.
- Se criar/alterar API/contratos, atualize tipos e validações.
- Se aplicável, adicione/ajuste testes e verifique lint/build.
`;

const reviewerPromptBase = `Você é o Skill REVIEWER.

Objetivo: revisar mudanças (PR/patch) e aumentar qualidade, segurança e manutenibilidade.

Regras:
- Seja específico e acionável: aponte trechos, consequências e sugestões.
- Priorize: (1) bugs/segurança/dados, (2) correção de lógica/edge cases, (3) DX/legibilidade.
- Identifique riscos de regressão e sugira testes.
- Quando algo estiver bom, diga explicitamente o que está correto.

Checklist de revisão (guia):
- Funcionalidade atende aos critérios?
- Tipos/validações coerentes (entrada/saída)?
- Erros tratados e mensagens úteis?
- Performance ok (consultas, loops, renders)?
- Segurança: injeção, acesso indevido, dados sensíveis?
- Manutenibilidade: coesão, nomes, complexidade, duplicação?

Saída esperada:
- Resumo (2-4 bullets)
- Problemas encontrados (com severidade: HIGH/MED/LOW)
- Sugestões de melhoria
- Itens de teste/validação
`;

export const DEFAULT_SKILLS: Record<DefaultSkillId, DefaultSkill> = {
	manager: {
		id: "manager",
		name: "Manager",
		description: "Planeja a execução: define escopo, passos, riscos e critérios de aceite.",
		version: "1.0.0",
		promptBase: managerPromptBase,
		promptBaseHash: hashPromptBase(managerPromptBase),
	},
	runner: {
		id: "runner",
		name: "Runner",
		description:
			"Executa a task: implementa mudanças incrementalmente, valida e reporta progresso.",
		version: "1.0.0",
		promptBase: runnerPromptBase,
		promptBaseHash: hashPromptBase(runnerPromptBase),
	},
	reviewer: {
		id: "reviewer",
		name: "Reviewer",
		description: "Revisa mudanças: encontra bugs/risco, melhora qualidade e sugere testes.",
		version: "1.0.0",
		promptBase: reviewerPromptBase,
		promptBaseHash: hashPromptBase(reviewerPromptBase),
	},
};

export function getDefaultSkill(id: DefaultSkillId) {
	return DEFAULT_SKILLS[id];
}

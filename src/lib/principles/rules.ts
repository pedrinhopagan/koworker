// Lib PURA de lint de princípios: opera só sobre strings já parseadas (frontmatter + corpo). NÃO
// importa @/api, env, connection nem nada de servidor — assim os testes rodam sob `bun test` mesmo
// com NODE_ENV=test. As regras são heurísticas honestas e conservadoras (preferem falso-negativo a
// falso-positivo). Detectam pt-BR e en.
//
// Princípios MECANIZADOS (viram regra/badge): brevidade (generic-scaffolding-headers, not-brief),
// não documentar competência óbvia (obvious-competence), descrição nomeia o gatilho
// (description-summarizes, description-missing), evitar cláusulas `unless` (unless-clauses), cortar
// justificativa conversacional (conversational-justification), fronteiras explícitas de agent
// (agent-missing-tools), não padronizar a saída do agent (agent-output-standardization).
//
// Princípios de JULGAMENTO (NÃO mecanizáveis — só guia em PRINCIPLES_GUIDE, sem regra): generalizar
// pra fora do caso-gatilho, regras nascem de falhas observadas, negativo só depois do positivo
// falhar, exemplos são último recurso, dois formatos válidos (instrução vs documentação).

export type PrinciplesInput = {
	kind: "skill" | "agent";
	slug: string;
	name: string;
	description: string;
	body: string;
	metadata: Record<string, unknown>;
};

export type PrinciplesFinding = {
	ruleId: string;
	title: string;
	severity: "warn" | "info";
	detail: string;
};

export type PrinciplesRule = {
	id: string;
	title: string;
	severity: "warn" | "info";
	appliesTo: ("skill" | "agent")[];
	detail: string;
	check: (input: PrinciplesInput) => boolean;
};

function containsAny(haystackLower: string, phrasesLower: string[]): boolean {
	return phrasesLower.some((phrase) => haystackLower.includes(phrase));
}

// Linhas de cabeçalho markdown (^#{1,6}\s), normalizadas (trim + lowercase, sem o `#`).
function headingTitles(body: string): string[] {
	const titles: string[] = [];

	for (const line of body.split("\n")) {
		const match = line.match(/^#{1,6}\s+(.*)$/);
		if (!match) continue;

		titles.push(match[1].trim().toLowerCase());
	}

	return titles;
}

const GENERIC_HEADINGS = new Set([
	"quick start",
	"workflows",
	"review checklist",
	"overview",
	"getting started",
	"prerequisites",
	"conclusion",
	"summary",
	"visão geral",
	"pré-requisitos",
	"introdução",
	"resumo",
	"checklist de revisão",
]);

const OBVIOUS_COMPETENCE = [
	"read first",
	"inspect the code",
	"understand the context",
	"think carefully",
	"leia primeiro",
	"entenda o contexto",
	"pense com cuidado",
	"analise com cuidado",
];

const TRIGGER_CUES = ["use when", "use para", "quando", "dispara", "ao ", "trigger"];

const UNLESS_CLAUSES = ["unless", "a menos que", "exceto se", "salvo se"];

const CONVERSATIONAL = [
	"the reason is",
	"this is because",
	"as you can see",
	"keep in mind",
	"obviously",
	"vale lembrar",
	"como você pode ver",
];

const OUTPUT_STANDARDIZATION = [
	"format your response",
	"output format",
	"responda no formato",
	"formato de saída",
];

export const RULES: PrinciplesRule[] = [
	{
		id: "generic-scaffolding-headers",
		title: "Cabeçalhos genéricos",
		severity: "warn",
		appliesTo: ["skill", "agent"],
		detail:
			'O corpo tem cabeçalhos de andaime genéricos (ex.: "Overview", "Quick start", "Visão geral") — forma sem substância. Brevidade é load-bearing: cada linha precisa de razão.',
		check: (input) => {
			const titles = headingTitles(input.body);
			return titles.some((title) => GENERIC_HEADINGS.has(title));
		},
	},
	{
		id: "obvious-competence",
		title: "Competência óbvia",
		severity: "info",
		appliesTo: ["skill", "agent"],
		detail:
			'O corpo documenta competência óbvia (ex.: "read first", "entenda o contexto", "pense com cuidado"). Regras devem mudar comportamento, não elogiar o modelo por ter cérebro.',
		check: (input) => containsAny(input.body.toLowerCase(), OBVIOUS_COMPETENCE),
	},
	{
		id: "description-summarizes",
		title: "Descrição resume em vez de nomear o gatilho",
		severity: "warn",
		appliesTo: ["skill", "agent"],
		detail:
			'A descrição é longa e não tem pista de gatilho (ex.: "use when", "quando"). O único papel da descrição é carregar a skill/agent no momento certo — nomeie o gatilho, não resuma o conteúdo.',
		check: (input) => {
			const isLong = input.description.length > 280;
			if (!isLong) {
				return false;
			}

			const hasTriggerCue = containsAny(input.description.toLowerCase(), TRIGGER_CUES);
			return !hasTriggerCue;
		},
	},
	{
		id: "description-missing",
		title: "Descrição ausente",
		severity: "warn",
		appliesTo: ["skill", "agent"],
		detail:
			"A descrição está vazia. Sem descrição não há como decidir quando carregar a skill/agent.",
		check: (input) => input.description.trim().length === 0,
	},
	{
		id: "unless-clauses",
		title: 'Cláusulas "unless"',
		severity: "info",
		appliesTo: ["skill", "agent"],
		detail:
			'O conteúdo usa cláusulas de exceção ("unless", "a menos que"). Elas parecem precisas mas contrabandeiam escape hatches; prefira uma regra direta.',
		check: (input) =>
			containsAny(`${input.description}\n${input.body}`.toLowerCase(), UNLESS_CLAUSES),
	},
	{
		id: "not-brief",
		title: "Corpo extenso",
		severity: "info",
		appliesTo: ["skill", "agent"],
		detail:
			"O corpo é longo (> 200 linhas não-vazias ou > 1500 palavras). Brevidade é load-bearing: provavelmente há andaime que não muda comportamento.",
		check: (input) => {
			const nonEmptyLines = input.body.split("\n").filter((line) => line.trim().length > 0).length;
			const words = input.body.split(/\s+/).filter((word) => word.length > 0).length;
			return nonEmptyLines > 200 || words > 1500;
		},
	},
	{
		id: "conversational-justification",
		title: "Justificativa conversacional",
		severity: "info",
		appliesTo: ["skill", "agent"],
		detail:
			'O corpo tem justificativa conversacional (ex.: "the reason is", "vale lembrar"). Mantenha só contexto durável; corte a conversa.',
		check: (input) => containsAny(input.body.toLowerCase(), CONVERSATIONAL),
	},
	{
		id: "agent-missing-tools",
		title: "Agent sem ferramentas declaradas",
		severity: "info",
		appliesTo: ["agent"],
		detail:
			"O frontmatter não declara `tools`, então o agent herda todas as ferramentas — uma fronteira implícita. Fronteiras devem ser explícitas.",
		check: (input) => {
			const tools = input.metadata.tools;
			if (typeof tools === "string") {
				return tools.trim().length === 0;
			}

			if (Array.isArray(tools)) {
				return tools.length === 0;
			}

			return tools === undefined || tools === null;
		},
	},
	{
		id: "agent-output-standardization",
		title: "Padronização da saída",
		severity: "info",
		appliesTo: ["agent"],
		detail:
			'O corpo padroniza o formato de saída (ex.: "output format", "formato de saída"). Descreva o que o agent faz, não como formatar a resposta.',
		check: (input) => containsAny(input.body.toLowerCase(), OUTPUT_STANDARDIZATION),
	},
];

// Guia legível "o que é uma boa skill/agent" — adaptado e generalizado dos skill-principles. Inclui
// os princípios de JULGAMENTO que não viram regra (não há heurística honesta que os meça).
export const PRINCIPLES_GUIDE: { id: string; title: string; body: string }[] = [
	{
		id: "brevity",
		title: "Brevidade é load-bearing",
		body: 'Cada linha precisa de uma razão presente. Não adicione andaime genérico — "Quick start", "Workflows", "Review Checklist" — forma sem substância.',
	},
	{
		id: "no-obvious-competence",
		title: "Não documente competência óbvia",
		body: '"Leia primeiro", "inspecione o código", "entenda o contexto", "pense com cuidado" são ruído. Regras mudam comportamento, não elogiam o modelo por ter cérebro.',
	},
	{
		id: "description-names-trigger",
		title: "A descrição nomeia o gatilho",
		body: "O único papel da descrição é carregar a skill/agent no momento certo. Não resuma o que está dentro.",
	},
	{
		id: "two-valid-shapes",
		title: "Dois formatos válidos: instrução vs documentação",
		body: "Skills de instrução produzem um artefato quando invocadas — escreva comandos. Skills de documentação informam comportamento ao longo de muitas ações — escreva contexto, fatos duráveis. Escolha conscientemente: isto vira artefato a cada execução ou molda comportamento de fundo?",
	},
	{
		id: "rules-from-failures",
		title: "Regras respondem a falhas observadas",
		body: "Toda diretriz remonta a um padrão de falha real. Não invente guardas para conflitos hipotéticos, estados bloqueados ou edge cases imaginados — eles adicionam superfície sem prevenir nada.",
	},
	{
		id: "generalize-away",
		title: "Generalize pra fora do caso-gatilho",
		body: "O exemplo do usuário é evidência, não wording reutilizável. Imagine uma situação totalmente diferente onde a mesma regra ainda vale e escreva a regra a partir dela. Código, nomes, frases, libs, arquivos e formato da tarefa originais não reaparecem.",
	},
	{
		id: "negative-after-positive",
		title: "Negativo só depois do positivo falhar",
		body: 'A primeira tentativa é positiva. Só adicione "não faça Y" depois de observar "faça X" falhando na prática.',
	},
	{
		id: "examples-last-resort",
		title: "Exemplos são último recurso",
		body: "Não adicione um exemplo até que a regra abstrata tenha sido observada falhando.",
	},
	{
		id: "no-unless",
		title: 'Não escreva cláusulas "unless"',
		body: "Elas parecem precisas mas contrabandeiam escape hatches para dentro das regras. Prefira uma regra direta.",
	},
	{
		id: "no-output-standardization",
		title: "Não padronize a saída do agent",
		body: "Descreva o que o agent faz, não como formatar a resposta.",
	},
	{
		id: "skill-is-first-example",
		title: "A skill é o primeiro exemplo",
		body: "Quando uma regra bane algo, o corpo não deve conter o que baniu. A skill é o primeiro exemplo de si mesma.",
	},
	{
		id: "no-conversational-justification",
		title: "Corte justificativas conversacionais",
		body: "Mantenha só contexto durável. Tire da skill a conversa que justifica cada regra.",
	},
];

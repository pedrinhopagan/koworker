// Estruturas pré-moldadas do prompt-bar: cada template define os campos colapsáveis (Goal, Contexto,
// ...) que o painel de estrutura renderiza e que entram no corpo do prompt como "Label: valor".
// Os slugs são idênticos aos de `categories.structure_slug` — o vínculo categoria→estrutura é o
// mesmo conjunto finito, então a constante é a fonte de verdade dos dois lados.
export const PROMPT_TEMPLATE_SLUGS = ["feature", "fix", "doc", "study"] as const;

export type PromptTemplateSlug = (typeof PROMPT_TEMPLATE_SLUGS)[number];

export interface PromptTemplateField {
	key: string;
	label: string;
	placeholder: string;
}

export interface PromptTemplate {
	slug: PromptTemplateSlug;
	label: string;
	hint: string;
	fields: PromptTemplateField[];
}

export const PROMPT_TEMPLATES: PromptTemplate[] = [
	{
		slug: "feature",
		label: "Feature",
		hint: "Orquestração: objetivo, contexto e delegação aos subagents",
		fields: [
			{
				key: "goal",
				label: "Goal",
				placeholder: "O resultado desejado, em uma frase — sem prescrever o como",
			},
			{
				key: "contexto",
				label: "Contexto",
				placeholder: "Arquivos, restrições e decisões já tomadas",
			},
			{
				key: "delegacao",
				label: "Delegação",
				placeholder:
					"Quem faz o quê (raciocínio, mecânico, perspectiva externa); plano antes de executar",
			},
		],
	},
	{
		slug: "fix",
		label: "Fix",
		hint: "Relato de bug: sintoma, reprodução e comportamento esperado",
		fields: [
			{ key: "sintoma", label: "Sintoma", placeholder: "O que está acontecendo de errado" },
			{
				key: "reproducao",
				label: "Reprodução",
				placeholder: "Passos ou rota que disparam o problema",
			},
			{ key: "esperado", label: "Esperado", placeholder: "O comportamento correto" },
		],
	},
	{
		slug: "doc",
		label: "Doc",
		hint: "Documentação: assunto, leitor-alvo e fontes",
		fields: [
			{ key: "assunto", label: "Assunto", placeholder: "O que precisa ser documentado" },
			{ key: "leitor", label: "Leitor", placeholder: "Para quem escreve e o que já sabe" },
			{ key: "fontes", label: "Fontes", placeholder: "Arquivos, código e referências a consultar" },
		],
	},
	{
		slug: "study",
		label: "Study",
		hint: "Estudo: pergunta, contexto e formato da saída",
		fields: [
			{ key: "pergunta", label: "Pergunta", placeholder: "A questão central a investigar" },
			{ key: "contexto", label: "Contexto", placeholder: "O que já se sabe e por que importa" },
			{ key: "saida", label: "Saída", placeholder: "Formato e profundidade esperados da resposta" },
		],
	},
];

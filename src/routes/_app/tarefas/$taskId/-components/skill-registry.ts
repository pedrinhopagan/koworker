import type { LucideIcon } from "lucide-react";
import {
	CirclePlay,
	FileSearch,
	GitCommitHorizontal,
	ListChecks,
	Rocket,
	Wrench,
} from "lucide-react";

export const SKILL_IDS = {
	STRUCTURE_TASK: "koworker-structure",
	EXECUTE_ALL: "koworker-execute-all",
	EXECUTE_SUBTASKS: "koworker-execute-subtask",
	REVIEW_PLAN: "koworker-review",
	COMMIT: "koworker-commit",
	QUICKFIX: "koworker-quickfix",
} as const;

export type SkillId = (typeof SKILL_IDS)[keyof typeof SKILL_IDS];

export type Skill = {
	id: SkillId;
	label: string;
	description: string;
	icon: LucideIcon;
	color: string;
	instructions: string;
	requiresSubtaskSelection?: boolean;
};

const TASK_BASE = `## Base da Task (Koworker)

- \`description\` e a fonte principal dos requisitos e detalhes
- \`acceptance_criteria\` e uma lista JSON: \`[{ id, text, done }]\`
- Use \`notes\` para registrar observacoes relevantes da IA
- Subtasks devem ter \`title\` e \`description\` completos
- Ao atualizar \`acceptance_criteria\`, envie o array completo
- Status valido: \`pending\` | \`in_execution\` | \`executed\``;

export const SKILLS: Skill[] = [
	{
		id: SKILL_IDS.STRUCTURE_TASK,
		label: "Estruturar",
		description: "Estrutura a tarefa em subtasks detalhadas",
		icon: ListChecks,
		color: "#61afef",
		instructions: `${TASK_BASE}

## Objetivo

Estruturar a tarefa com detalhes completos, criterios de aceite e subtasks claras.

## Processo

1. **Entendimento**
   - Confirme objetivo e escopo com o usuario
   - Identifique pontos faltantes ou ambiguos

2. **Descricao completa**
   - Preencha \`description\` com requisitos e detalhes executaveis

3. **Criterios de aceite**
   - Crie \`acceptance_criteria\` com itens verificaveis
   - Cada item deve ter \`id\` estavel, \`text\` claro e \`done: false\`

4. **Subtasks (se necessario)**
   - Crie subtasks com \`title\` e \`description\` completos
   - Ordene por dependencias

5. **Metadados**
   - Atualize \`ai_metadata.lastCompletedAction\` para \`"structure"\`
   - Use \`notes\` para registrar decisoes importantes

## Regras

- Nao implemente codigo nesta etapa
- Sempre gere \`acceptance_criteria\`
- Subtasks devem ser claras e mensuraveis`,
	},
	{
		id: SKILL_IDS.EXECUTE_ALL,
		label: "Executar Tudo",
		description: "Executa todas as subtasks pendentes",
		icon: Rocket,
		color: "#98c379",
		instructions: `${TASK_BASE}

## Objetivo

Executar todas as subtasks pendentes da tarefa em sequencia.

## Processo

1. **Inicio**
   - Atualize a task para \`status: "in_execution"\`

2. **Execucao por subtask**
   - Marque a subtask como \`in_execution\`
   - Implemente seguindo \`description\`
   - Marque a subtask como \`executed\`
   - Mantenha \`title\` e \`description\` no update da subtask

3. **Criterios de aceite**
   - Atualize \`acceptance_criteria\` conforme os itens forem atendidos

4. **Finalizacao**
   - Atualize \`notes\` com resumo do que foi feito
   - Marque a task como \`executed\`

## Regras

- Uma subtask por vez, na ordem correta
- Nao pule validacoes importantes
- Se houver bloqueio, registre em \`notes\``,
	},
	{
		id: SKILL_IDS.EXECUTE_SUBTASKS,
		label: "Executar Subtask(s)",
		description: "Executa apenas as subtasks selecionadas",
		icon: CirclePlay,
		color: "#e5c07b",
		requiresSubtaskSelection: true,
		instructions: `${TASK_BASE}

## Objetivo

Executar apenas as subtasks selecionadas pelo usuario.

## Processo

1. **Foco**
   - Trabalhe apenas nas subtasks selecionadas
   - Respeite a ordem exibida

2. **Execucao por subtask**
   - Marque a subtask como \`in_execution\`
   - Implemente seguindo \`description\`
   - Marque a subtask como \`executed\`
   - Mantenha \`title\` e \`description\` no update da subtask

3. **Criterios de aceite**
   - Atualize \`acceptance_criteria\` conforme necessario

4. **Finalizacao**
   - Atualize \`notes\` com resumo das subtasks executadas

## Regras

- Nao altere subtasks nao selecionadas
- Mantenha escopo estrito`,
	},
	{
		id: SKILL_IDS.REVIEW_PLAN,
		label: "Revisar Plano",
		description: "Revisa a tarefa e faz perguntas",
		icon: FileSearch,
		color: "#c678dd",
		instructions: `${TASK_BASE}

## Objetivo

Revisar a tarefa, criterios de aceite e subtasks antes do commit.

## Processo

1. **Validacao**
   - Verifique se \`description\` cobre o escopo
   - Revise \`acceptance_criteria\` item a item
   - Confira se subtasks estao coerentes

2. **Verificacoes tecnicas**
   - Rode checks e testes relevantes (se existirem)

3. **Resumo**
   - Atualize \`notes\` com resultado e problemas encontrados
   - Se aprovado, setar \`ai_metadata.lastCompletedAction\` como \`"review"\`

## Regras

- Nao implemente codigo nesta etapa
- Seja objetivo e acionavel nos feedbacks`,
	},
	{
		id: SKILL_IDS.COMMIT,
		label: "Commit",
		description: "Cria um commit das alteracoes",
		icon: GitCommitHorizontal,
		color: "#56b6c2",
		instructions: `${TASK_BASE}

## Objetivo

Criar um commit git com as alteracoes feitas nesta tarefa.

## Processo

1. **Analise**
   - Execute \`git status\` e \`git diff\`
   - Selecione apenas arquivos relacionados

2. **Mensagem**
   - Use Conventional Commits
   - Descricao concisa em portugues

3. **Finalizacao**
   - Atualize \`notes\` com hash e arquivos commitados

## Regras

- Nunca commitar arquivos sensiveis
- Nao alterar \`ai_metadata.lastCompletedAction\``,
	},
	{
		id: SKILL_IDS.QUICKFIX,
		label: "Quick Fix",
		description: "Aplica um ajuste rapido e pontual",
		icon: Wrench,
		color: "#e06c75",
		instructions: `${TASK_BASE}

## Objetivo

Aplicar um ajuste rapido e pontual conforme descrito pelo usuario.

## Processo

1. **Entendimento**
   - Identifique exatamente o que precisa ser ajustado

2. **Execucao**
   - Faca apenas a mudanca solicitada
   - Evite refatoracoes

3. **Atualizacao**
   - Registre o que foi feito em \`notes\`
   - Atualize \`acceptance_criteria\` se o ajuste afetar algum item

## Regras

- Escopo minimo
- Clareza nas notas`,
	},
];

export function getSkillById(id: SkillId): Skill | undefined {
	return SKILLS.find((skill) => skill.id === id);
}

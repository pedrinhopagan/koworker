import type { LucideIcon } from "lucide-react";
import {
	CirclePlay,
	FileSearch,
	GitCommitHorizontal,
	ListChecks,
	Palette,
	Rocket,
} from "lucide-react";

export const SKILL_IDS = {
	STRUCTURE_TASK: "structure_task",
	UI_PROMPT: "ui_prompt",
	EXECUTE_ALL: "execute_all",
	EXECUTE_SUBTASKS: "execute_subtasks",
	REVIEW_PLAN: "review_plan",
	COMMIT: "commit",
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
	agentMode?: "plan" | "default";
};

export const SKILLS: Skill[] = [
	{
		id: SKILL_IDS.STRUCTURE_TASK,
		label: "Estruturar",
		description: "Estrutura a tarefa em subtasks detalhadas",
		icon: ListChecks,
		color: "#61afef",
		agentMode: "plan",
		instructions: `Analise a tarefa fornecida e estruture-a em subtasks bem definidas.

Regras:
1. Leia atentamente o título, descrição e critérios de aceitação da tarefa
2. Quebre a tarefa em subtasks menores e acionáveis
3. Cada subtask deve ser específica e ter um objetivo claro
4. Ordene as subtasks de forma lógica (dependências primeiro)
5. Use a CLI do Kowork para criar as subtasks no banco de dados

Utilize o comando: kowork update-task para atualizar a tarefa com as novas subtasks.`,
	},
	{
		id: SKILL_IDS.UI_PROMPT,
		label: "Prompt de UI",
		description: "Gera instruções detalhadas de UI",
		icon: Palette,
		color: "#e06c75",
		instructions: `Com base na tarefa fornecida, gere um prompt detalhado de UI/Frontend.

O prompt deve incluir:
1. Descrição visual do componente/tela
2. Estados possíveis (loading, error, empty, success)
3. Interações do usuário esperadas
4. Responsividade (mobile, tablet, desktop)
5. Acessibilidade (aria-labels, keyboard navigation)
6. Componentes UI base a utilizar (seguindo o design system existente)

Não implemente código ainda, apenas descreva as especificações de UI.`,
	},
	{
		id: SKILL_IDS.EXECUTE_ALL,
		label: "Executar Tudo",
		description: "Executa todas as subtasks pendentes",
		icon: Rocket,
		color: "#98c379",
		instructions: `Execute todas as subtasks pendentes da tarefa em sequência.

Regras:
1. Analise cada subtask e implemente na ordem correta
2. Marque cada subtask como "executed" ao concluir via CLI
3. Se encontrar bloqueios, documente no campo notes da tarefa
4. Mantenha o código limpo e seguindo os padrões do projeto
5. Rode testes se existirem e corrija falhas
6. Use a CLI Kowork para atualizar o status das subtasks

Comando: kowork update-task --id {taskId} para atualizar a tarefa.`,
	},
	{
		id: SKILL_IDS.EXECUTE_SUBTASKS,
		label: "Executar Subtask(s)",
		description: "Executa apenas as subtasks selecionadas",
		icon: CirclePlay,
		color: "#e5c07b",
		requiresSubtaskSelection: true,
		instructions: `Execute APENAS as subtasks selecionadas pelo usuário.

Regras:
1. Foque exclusivamente nas subtasks listadas em "selectedSubtasks"
2. Implemente cada uma na ordem em que aparecem
3. Marque cada subtask como "executed" ao concluir via CLI
4. Não toque em outras subtasks não selecionadas
5. Documente qualquer impedimento encontrado

Use a CLI Kowork para atualizar o status: kowork update-task`,
	},
	{
		id: SKILL_IDS.REVIEW_PLAN,
		label: "Revisar Plano",
		description: "Revisa a tarefa e faz perguntas",
		icon: FileSearch,
		color: "#c678dd",
		agentMode: "plan",
		instructions: `Revise criticamente a tarefa e suas subtasks.

Seu objetivo é:
1. Analisar se a descrição está clara e completa
2. Verificar se os critérios de aceitação são mensuráveis
3. Identificar gaps ou informações faltantes
4. Fazer perguntas específicas ao usuário sobre pontos ambíguos
5. Sugerir melhorias no plano se necessário

Não implemente nada ainda. Apenas analise e faça perguntas para clarificar o escopo.
Liste suas perguntas de forma numerada e clara.`,
	},
	{
		id: SKILL_IDS.COMMIT,
		label: "Commit",
		description: "Cria um commit das alterações",
		icon: GitCommitHorizontal,
		color: "#56b6c2",
		instructions: `Crie um commit git com as alterações feitas nesta tarefa.

Regras:
1. Analise os arquivos modificados com git status
2. Crie uma mensagem de commit seguindo conventional commits
3. O formato deve ser: tipo(escopo): descrição
4. Tipos: feat, fix, refactor, docs, style, test, chore
5. A descrição deve ser em português e concisa
6. Inclua o ID da tarefa se relevante

Exemplo: feat(tasks): implementa seleção múltipla de subtasks [TASK-123]

Use git add e git commit (sem push, a menos que solicitado).`,
	},
];

export const AGENTS = [
	{ value: "opencode", label: "OpenCode" },
	{ value: "claude_code", label: "Claude Code" },
	{ value: "codex", label: "Codex" },
] as const;

export type AgentType = (typeof AGENTS)[number]["value"];

export const MODELS = [
	{ value: "default", label: "OpenCode Default Model" },
	{ value: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
	{ value: "claude-opus-4-20250514", label: "Claude Opus 4" },
	{ value: "gpt-4-turbo", label: "GPT-4 Turbo" },
	{ value: "gpt-4o", label: "GPT-4o" },
] as const;

export type ModelType = (typeof MODELS)[number]["value"];

export function getSkillById(id: SkillId): Skill | undefined {
	return SKILLS.find((skill) => skill.id === id);
}

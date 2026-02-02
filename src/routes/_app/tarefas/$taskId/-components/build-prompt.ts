import type { SubtaskFull, TaskFull } from "@/types/tasks";

import type { Skill } from "./skill-registry";

export type BuildPromptParams = {
	userInput: string;
	skill: Skill;
	task: NonNullable<TaskFull>;
	selectedSubtaskIds: string[];
};

export type TaskPromptJson = {
	id: string;
	projectId: string;
	title: string;
	description: string | null;
	notes: string | null;
	aiMetadata: unknown;
	priorityId: string;
	categoryId: string;
	status: string;
	acceptanceCriteria: Array<{ id: string; text: string; done: boolean }>;
	subtasks: SubtaskFull[];
	category: { id: string; name: string; color: string } | null;
	priority: { id: string; name: string; color: string; level: number } | null;
	project: { id: string; name: string; color: string; mainRoute: string } | null;
	selectedSubtaskIds: string[];
	selectedSubtasks: SubtaskFull[];
	timestamp: string;
	locale: string;
};

export function buildPrompt(params: BuildPromptParams): string {
	const { userInput, skill, task, selectedSubtaskIds } = params;

	const selectedSubtasks = task.subtasks?.filter((s) => selectedSubtaskIds.includes(s.id)) ?? [];

	const taskJson: TaskPromptJson = {
		id: task.id,
		projectId: task.projectId,
		title: task.title,
		description: task.description ?? null,
		notes: task.notes ?? null,
		aiMetadata: task.aiMetadata,
		priorityId: task.priorityId,
		categoryId: task.categoryId,
		status: task.status,
		acceptanceCriteria: task.acceptanceCriteria,
		subtasks: task.subtasks ?? [],
		category: task.category,
		priority: task.priority,
		project: task.project,
		selectedSubtaskIds,
		selectedSubtasks,
		timestamp: new Date().toISOString(),
		locale: "pt-BR",
	};

	const userInputSection = userInput.trim()
		? `## Instrucoes do Usuario

${userInput.trim()}

---

`
		: "";

	const cliExampleUpdate = {
		taskId: task.id,
		status: "executed",
		notes: "Descricao do que foi feito...",
		acceptance_criteria: [
			{ id: "crit-1", text: "Criterio 1", done: true },
			{ id: "crit-2", text: "Criterio 2", done: false },
		],
		subtasks:
			selectedSubtasks.length > 0
				? selectedSubtasks.map((s) => ({
						id: s.id,
						title: s.title,
						description: s.description ?? "",
						status: "executed",
					}))
				: [
						{
							title: "Nova subtask exemplo",
							description: "Descreva a subtask...",
							status: "pending",
						},
					],
	};

	return `${userInputSection}## Skill: ${skill.label}

${skill.instructions}

---

## Dados da Tarefa (Koworker)

\`\`\`json
${JSON.stringify(taskJson, null, 2)}
\`\`\`

---

## CLI para Atualizacao da Tarefa

Apos completar o trabalho, atualize o status da tarefa usando a CLI do Koworker:

\`\`\`bash
kowork update-task '<JSON>'
\`\`\`

### Schema do JSON de entrada

| Campo | Tipo | Descricao |
|-------|------|-----------|
| \`taskId\` | string (obrigatorio) | ID da tarefa: \`${task.id}\` |
| \`title\` | string | Titulo da tarefa |
| \`description\` | string | Descricao detalhada da tarefa |
| \`status\` | "pending" \\| "in_execution" \\| "executed" | Status da tarefa |
| \`notes\` | string | Notas/observacoes da IA sobre o trabalho realizado |
| \`ai_metadata\` | object | Metadados JSON adicionais |
| \`acceptance_criteria\` | array | Criterios de aceitacao: \`[{ id, text, done }]\` |
| \`subtasks\` | array | Lista de subtasks (ver abaixo) |

### Subtasks

- **Atualizar subtask existente**: incluir \`id\` e manter \`title\`/\`description\`
- **Criar nova subtask**: omitir \`id\` (sera gerado automaticamente)

\`\`\`typescript
{
  id?: string,           // Se presente: atualiza; Se ausente: cria nova
  title: string,         // Titulo da subtask (obrigatorio para criar)
  description?: string,  // Descricao opcional
  status?: "pending" | "in_execution" | "executed"
}
\`\`\`

### Exemplo de atualizacao completa

\`\`\`bash
kowork update-task '${JSON.stringify(cliExampleUpdate)}'
\`\`\`

### Regras importantes

1. Sempre use o \`taskId\` correto: \`${task.id}\`
2. Ao concluir uma subtask, mude seu \`status\` para \`"executed"\`
3. Ao concluir toda a tarefa, mude o \`status\` da task para \`"executed"\`
4. Sempre preencha \`acceptance_criteria\` como lista JSON com \`{ id, text, done }\`
5. Ao atualizar \`acceptance_criteria\`, envie o array completo
6. Mesmo sendo armazenado como string, mantenha o formato de lista JSON
7. Use o campo \`notes\` para documentar o que foi feito
8. Nao defina \`completed_at\` - isso e feito pelo usuario ao aprovar`;
}

export function getCustomInstructions(skillId: string): string | null {
	if (typeof window === "undefined") return null;
	const key = `kowork_skill_instructions_${skillId}`;
	return localStorage.getItem(key);
}

export function setCustomInstructions(skillId: string, instructions: string): void {
	if (typeof window === "undefined") return;
	const key = `kowork_skill_instructions_${skillId}`;
	if (instructions.trim()) {
		localStorage.setItem(key, instructions);
	} else {
		localStorage.removeItem(key);
	}
}

export function buildPromptWithCustomInstructions(params: BuildPromptParams): string {
	const customInstructions = getCustomInstructions(params.skill.id);

	if (customInstructions) {
		return buildPrompt({
			...params,
			skill: {
				...params.skill,
				instructions: customInstructions,
			},
		});
	}

	return buildPrompt(params);
}

import type { TaskSkill } from "@/types/skills";
import type { TaskFull } from "@/types/tasks";

export type BuildPromptParams = {
	userInput: string;
	skill: TaskSkill;
	task: NonNullable<TaskFull>;
	selectedSubtaskIds: string[];
	selectedParentTask?: boolean;
};

export type BuildCleanPromptParams = {
	userInput: string;
	skillSlug: string;
};

function formatStatus(status: string): string {
	const map: Record<string, string> = {
		pending: "pendente",
		in_execution: "em execucao",
		executed: "executada",
	};
	return map[status] ?? status;
}

function buildTaskMarkdown(params: {
	task: NonNullable<TaskFull>;
	selectedSubtaskIds: string[];
	selectedParentTask: boolean;
}): string {
	const { task, selectedSubtaskIds, selectedParentTask } = params;
	const subtasks = task.subtasks ?? [];
	const hasSelection = selectedSubtaskIds.length > 0;
	const selectedSet = new Set(selectedSubtaskIds);

	const lines: string[] = [
		`## Dados da Tarefa (Koworker)`,
		"",
		`**ID:** \`${task.id}\``,
		`**Titulo:** ${task.title}`,
		`**Status:** ${formatStatus(task.status)}`,
		`**Projeto:** ${task.project?.name ?? "—"} (\`${task.project?.mainRoute ?? "—"}\`)`,
		`**Categoria:** ${task.category?.name ?? "—"}`,
		`**Prioridade:** ${task.priority?.name ?? "—"}`,
	];

	if (selectedParentTask) {
		lines.push("");
		lines.push(`> **Tarefa pai selecionada para acao direta.**`);
	}

	if (task.description) {
		lines.push("");
		lines.push(`### Descricao`);
		lines.push("");
		lines.push(task.description);
	}

	if (task.notes) {
		lines.push("");
		lines.push(`### Notas da IA`);
		lines.push("");
		lines.push(task.notes);
	}

	if (task.acceptanceCriteria?.length) {
		lines.push("");
		lines.push(`### Criterios de Aceite`);
		lines.push("");
		for (const c of task.acceptanceCriteria) {
			const check = c.done ? "x" : " ";
			lines.push(`- [${check}] \`${c.id}\` ${c.text}`);
		}
	}

	if (subtasks.length > 0) {
		lines.push("");
		lines.push(`### Subtasks`);

		if (hasSelection) {
			const selected = subtasks.filter((s) => selectedSet.has(s.id));
			const others = subtasks.filter((s) => !selectedSet.has(s.id));

			lines.push("");
			lines.push(`**Selecionadas para execucao (${selected.length}):**`);
			for (const s of selected) {
				lines.push("");
				lines.push(`#### ▶ ${s.title}`);
				lines.push(`- **ID:** \`${s.id}\``);
				lines.push(`- **Status:** ${formatStatus(s.status)}`);
				if (s.description) {
					lines.push(`- **Descricao:** ${s.description}`);
				}
			}

			if (others.length > 0) {
				lines.push("");
				lines.push(`**Demais subtasks (apenas contexto):**`);
				for (const s of others) {
					lines.push(`- ${s.title} — ${formatStatus(s.status)}`);
				}
			}
		} else {
			lines.push("");
			for (const s of subtasks) {
				lines.push("");
				lines.push(`#### ${s.title}`);
				lines.push(`- **ID:** \`${s.id}\``);
				lines.push(`- **Status:** ${formatStatus(s.status)}`);
				if (s.description) {
					lines.push(`- **Descricao:** ${s.description}`);
				}
			}
		}
	}

	if (task.aiMetadata && Object.keys(task.aiMetadata as Record<string, unknown>).length > 0) {
		lines.push("");
		lines.push(`### Metadados`);
		lines.push("");
		lines.push("```json");
		lines.push(JSON.stringify(task.aiMetadata, null, 2));
		lines.push("```");
	}

	return lines.join("\n");
}

export function buildPrompt(params: BuildPromptParams): string {
	const { userInput, skill, task, selectedSubtaskIds, selectedParentTask = false } = params;

	const userInputSection = userInput.trim()
		? `## Prompt do Usuario (Prioridade Alta)

${userInput.trim()}`
		: "## Prompt do Usuario (Prioridade Alta)\n\nNenhuma instrucao adicional enviada pelo usuario.";

	const userPromptHint = userInput.trim()
		? "seguindo o prompt do usuario acima"
		: "seguindo as instrucoes acima";

	const skillInvocationSection = `## Skill Obrigatoria

VOCE DEVE usar a skill "${skill.slug}" para esta tarefa${userInput.trim() ? ", " + userPromptHint : ""}.

### Como usar
1. Invoque a ferramenta Skill com name="${skill.slug}"
2. Anuncie: "Usando skill ${skill.slug} para [proposito]"
3. Siga as instrucoes da skill EXATAMENTE

### IMPORTANTE - NAO RACIONALIZE
- NAO pense "isso e simples demais para usar skill" - USE A SKILL
- NAO pense "vou explorar primeiro" - A SKILL DIZ COMO EXPLORAR
- NAO pense "ja sei o que fazer" - A SKILL TEM O PROCESSO ATUAL
- Isso NAO e opcional. NAO e negociavel. USE A SKILL.`;

	const taskDataSection = buildTaskMarkdown({ task, selectedSubtaskIds, selectedParentTask });

	const sections = [userInputSection, skillInvocationSection, taskDataSection];

	return sections.join("\n\n---\n\n");
}

export function buildCleanPrompt(params: BuildCleanPromptParams): string {
	const { userInput, skillSlug } = params;

	const parts: string[] = [];

	if (userInput.trim()) {
		parts.push(userInput.trim());
	}

	parts.push(`Use a skill "${skillSlug}". Nao mencione a tarefa.`);

	return parts.join("\n\n");
}

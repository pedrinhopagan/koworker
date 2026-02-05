import type { TaskSkill } from "@/types/skills";
import type { SubtaskFull, TaskFull } from "@/types/tasks";

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
	selectedParentTask: boolean;
	timestamp: string;
	locale: string;
};

export function buildPrompt(params: BuildPromptParams): string {
	const { userInput, skill, task, selectedSubtaskIds, selectedParentTask = false } = params;

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
		selectedParentTask,
		timestamp: new Date().toISOString(),
		locale: "pt-BR",
	};

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

	const baseInstructionsSection = `## Instrucoes do Koworker

Estas instrucoes sao comuns a todas as skills e garantem o uso correto do app.

### Uso da CLI

- Sempre use a ferramenta Bash para executar o comando \`kowork update-task '<JSON>'\`
- Verifique o output do comando (deve mostrar mensagem de sucesso)
- Se houver erro, corrija e tente novamente
- Nao prossiga sem confirmar que o comando foi executado com sucesso

### Base da Task (Koworker)

- \`description\` e a fonte principal dos requisitos e detalhes
- \`acceptance_criteria\` e uma lista JSON: \`[{ id, text, done }]\`
- Use \`notes\` para registrar observacoes relevantes da IA
- Subtasks devem ter \`title\` e \`description\` completos
- Ao criar subtasks, defina \`displayOrder\` sequencial e nao numere os titulos
- Ao atualizar \`acceptance_criteria\`, envie o array completo
- Status valido: \`pending\` | \`in_execution\` | \`executed\`

### CLI para Atualizacao da Tarefa

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
  displayOrder?: number  // Ordem sequencial (0..n-1) na lista
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
8. Ao criar subtasks, use \`displayOrder\` sequencial e nao numere titulos
9. Nao defina \`completed_at\` - isso e feito pelo usuario ao aprovar`;

	const userInputSection = userInput.trim()
		? `## Prompt do Usuario

${userInput.trim()}`
		: null;

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

	const taskDataSection = `## Dados da Tarefa (Koworker)

\`\`\`json
${JSON.stringify(taskJson, null, 2)}
\`\`\``;

	const sections = [
		baseInstructionsSection,
		userInputSection,
		skillInvocationSection,
		taskDataSection,
	].filter(Boolean);

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

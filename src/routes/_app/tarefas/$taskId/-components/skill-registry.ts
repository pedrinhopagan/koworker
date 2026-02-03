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
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Faca perguntas** ao usuario para esclarecer objetivo e escopo
3. **Estruture a tarefa** com description, acceptance_criteria e subtasks
4. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

${TASK_BASE}

## Objetivo

Estruturar a tarefa com detalhes completos, criterios de aceite e subtasks claras.

## Processo

1. **Entendimento**
   - Leia atentamente as "Instrucoes do Usuario" no inicio do prompt
   - Confirme objetivo e escopo com o usuario
   - Identifique pontos faltantes ou ambiguos
   - Faca perguntas para esclarecer requisitos

2. **Descricao completa**
   - Preencha \`description\` com requisitos e detalhes executaveis
   - Seja claro e objetivo

3. **Criterios de aceite**
   - Crie \`acceptance_criteria\` com itens verificaveis
   - Cada item deve ter \`id\` estavel (ex: "crit-1", "crit-2"), \`text\` claro e \`done: false\`
   - Os criterios devem ser mensuraveis e acionaveis

4. **Subtasks (se necessario)**
   - Crie subtasks com \`title\` e \`description\` completos
   - Ordene por dependencias
   - Cada subtask deve ter um objetivo claro

5. **Metadados**
   - Atualize \`ai_metadata.lastCompletedAction\` para \`"structure"\`
   - Use \`notes\` para registrar decisoes importantes tomadas durante a estruturacao

6. **Finalizacao**
   - Execute o comando \`kowork update-task\` com todos os dados estruturados (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Tarefa estruturada no Koworker, volte ao app para visualizar os detalhes."

## Regras

- **NAO implemente codigo nesta etapa** - apenas estruture a tarefa
- **NAO execute a tarefa** - o objetivo e apenas preparar o plano de execucao
- Sempre gere \`acceptance_criteria\` com IDs estaveis
- Subtasks devem ser claras, mensuraveis e executaveis
- Use a CLI \`kowork update-task\` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
	{
		id: SKILL_IDS.EXECUTE_ALL,
		label: "Executar Tudo",
		description: "Executa todas as subtasks pendentes",
		icon: Rocket,
		color: "#98c379",
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Execute todas as subtasks** pendentes em sequencia
3. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` apos cada subtask (documentado abaixo)
4. **Verifique o sucesso** da execucao do comando antes de finalizar
5. **Finalize** com: "✅ Todas as subtasks foram executadas no Koworker, volte ao app para revisar."

${TASK_BASE}

## Objetivo

Executar todas as subtasks pendentes da tarefa em sequencia.

## Processo

1. **Inicio**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Atualize a task para \`status: "in_execution"\` via CLI \`kowork update-task\`

2. **Execucao por subtask**
   - Para cada subtask pendente (na ordem):
     - Marque a subtask como \`status: "in_execution"\` via CLI \`kowork update-task\`
     - Implemente seguindo a \`description\` da subtask
     - Marque a subtask como \`status: "executed"\` via CLI \`kowork update-task\`
     - Mantenha \`title\` e \`description\` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize \`acceptance_criteria\` via CLI conforme os itens forem atendidos
   - Marque cada criterio como \`done: true\` quando completado
   - Envie o array completo de acceptance_criteria

4. **Finalizacao**
   - Atualize \`notes\` com resumo completo do que foi implementado
   - Marque a task como \`status: "executed"\`
   - Execute o comando \`kowork update-task\` final (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Todas as subtasks foram executadas no Koworker, volte ao app para revisar."

## Regras

- Uma subtask por vez, na ordem correta
- Nao pule validacoes importantes
- Se houver bloqueio, registre em \`notes\` e atualize via CLI
- Use a CLI \`kowork update-task\` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
	{
		id: SKILL_IDS.EXECUTE_SUBTASKS,
		label: "Executar Subtask(s)",
		description: "Executa apenas as subtasks selecionadas",
		icon: CirclePlay,
		color: "#e5c07b",
		requiresSubtaskSelection: true,
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Execute apenas as subtasks selecionadas** pelo usuario
3. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` apos cada subtask (documentado abaixo)
4. **Verifique o sucesso** da execucao do comando antes de finalizar
5. **Finalize** com: "✅ Subtask(s) selecionada(s) executada(s) no Koworker, volte ao app para revisar."

${TASK_BASE}

## Objetivo

Executar apenas as subtasks selecionadas pelo usuario.

## Processo

1. **Foco**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Trabalhe apenas nas subtasks listadas em \`selectedSubtasks\`
   - Respeite a ordem exibida

2. **Execucao por subtask**
   - Para cada subtask selecionada:
     - Marque a subtask como \`status: "in_execution"\` via CLI \`kowork update-task\`
     - Implemente seguindo a \`description\` da subtask
     - Marque a subtask como \`status: "executed"\` via CLI \`kowork update-task\`
     - Mantenha \`title\` e \`description\` originais ao atualizar a subtask

3. **Criterios de aceite**
   - Atualize \`acceptance_criteria\` via CLI conforme necessario
   - Marque apenas os criterios relacionados as subtasks executadas
   - Envie o array completo de acceptance_criteria

4. **Finalizacao**
   - Atualize \`notes\` com resumo das subtasks executadas
   - Execute o comando \`kowork update-task\` final (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Subtask(s) selecionada(s) executada(s) no Koworker, volte ao app para revisar."

## Regras

- **Nao altere subtasks nao selecionadas** - mantenha escopo estrito
- Apenas trabalhe nas subtasks listadas em \`selectedSubtasks\`
- Use a CLI \`kowork update-task\` para persistir todas as mudancas
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
	{
		id: SKILL_IDS.REVIEW_PLAN,
		label: "Revisar Plano",
		description: "Revisa a tarefa e faz perguntas",
		icon: FileSearch,
		color: "#c678dd",
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Revise a tarefa** validando description, acceptance_criteria e subtasks
3. **Execute verificacoes tecnicas** se existirem (testes, checks, etc.)
4. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Revisao concluida no Koworker, volte ao app para visualizar o resultado."

${TASK_BASE}

## Objetivo

Revisar a tarefa, criterios de aceite e subtasks antes do commit.

## Processo

1. **Validacao**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Verifique se \`description\` cobre todo o escopo da tarefa
   - Revise \`acceptance_criteria\` item a item
   - Confira se subtasks estao coerentes e bem definidas
   - Identifique gaps, inconsistencias ou pontos faltantes

2. **Verificacoes tecnicas**
   - Rode checks e testes relevantes (se existirem)
   - Verifique se o codigo implementado atende os requisitos
   - Valide integracao e qualidade

3. **Resumo**
   - Atualize \`notes\` via CLI com resultado detalhado da revisao
   - Liste problemas encontrados e recomendacoes
   - Se aprovado, setar \`ai_metadata.lastCompletedAction\` como \`"review"\`

4. **Finalizacao**
   - Execute o comando \`kowork update-task\` com os resultados da revisao (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Revisao concluida no Koworker, volte ao app para visualizar o resultado."

## Regras

- **NAO implemente codigo nesta etapa** - apenas revise o que foi feito
- Seja objetivo e acionavel nos feedbacks
- Use a CLI \`kowork update-task\` para persistir os resultados da revisao
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
	{
		id: SKILL_IDS.COMMIT,
		label: "Commit",
		description: "Cria um commit das alteracoes",
		icon: GitCommitHorizontal,
		color: "#56b6c2",
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Analise as alteracoes** com git status e git diff
3. **Crie o commit git** seguindo Conventional Commits
4. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Commit criado e registrado no Koworker, volte ao app para continuar."

${TASK_BASE}

## Objetivo

Criar um commit git com as alteracoes feitas nesta tarefa.

## Processo

1. **Analise**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Execute \`git status\` para ver arquivos modificados
   - Execute \`git diff\` para revisar as mudancas
   - Selecione apenas arquivos relacionados a esta tarefa

2. **Mensagem**
   - Use Conventional Commits (feat, fix, refactor, docs, etc.)
   - Descricao concisa em portugues
   - Referencie a tarefa se aplicavel

3. **Commit**
   - Execute \`git add\` nos arquivos selecionados
   - Execute \`git commit -m "mensagem"\`
   - Capture o hash do commit

4. **Finalizacao**
   - Atualize \`notes\` via CLI com: hash do commit, mensagem e lista de arquivos commitados
   - Execute o comando \`kowork update-task\` (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Commit criado e registrado no Koworker, volte ao app para continuar."

## Regras

- **Nunca commitar arquivos sensiveis** (.env, credentials, tokens, etc.)
- Nao alterar \`ai_metadata.lastCompletedAction\` (manter valor atual)
- Use a CLI \`kowork update-task\` para registrar o commit
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
	{
		id: SKILL_IDS.QUICKFIX,
		label: "Quick Fix",
		description: "Aplica um ajuste rapido e pontual",
		icon: Wrench,
		color: "#e06c75",
		instructions: `## Como usar este prompt

1. **Leia as "Instrucoes do Usuario"** no inicio deste prompt
2. **Identifique o ajuste** necessario exatamente como descrito
3. **Execute a mudanca** de forma pontual e minima
4. **Atualize a tarefa via CLI** usando o comando \`kowork update-task\` (documentado abaixo)
5. **Verifique o sucesso** da execucao do comando antes de finalizar
6. **Finalize** com: "✅ Ajuste aplicado e registrado no Koworker, volte ao app para validar."

${TASK_BASE}

## Objetivo

Aplicar um ajuste rapido e pontual conforme descrito pelo usuario.

## Processo

1. **Entendimento**
   - Leia as "Instrucoes do Usuario" no inicio do prompt
   - Identifique exatamente o que precisa ser ajustado
   - Confirme o escopo se houver ambiguidade

2. **Execucao**
   - Faca apenas a mudanca solicitada
   - Evite refatoracoes ou melhorias nao solicitadas
   - Mantenha o escopo minimo

3. **Atualizacao**
   - Registre o que foi feito em \`notes\` via CLI
   - Atualize \`acceptance_criteria\` se o ajuste afetar algum item
   - Envie o array completo de acceptance_criteria

4. **Finalizacao**
   - Execute o comando \`kowork update-task\` com o registro do ajuste (ver secao "CLI para Atualizacao da Tarefa" abaixo)
   - Verifique se o comando retornou mensagem de sucesso
   - Finalize com: "✅ Ajuste aplicado e registrado no Koworker, volte ao app para validar."

## Regras

- **Escopo minimo** - faca apenas o que foi solicitado
- Clareza nas notas - descreva exatamente o que foi alterado
- Evite refatoracoes ou "melhorias" nao pedidas
- Use a CLI \`kowork update-task\` para registrar o ajuste
- Verifique o sucesso do comando CLI antes de finalizar`,
	},
];

export function getSkillById(id: SkillId): Skill | undefined {
	return SKILLS.find((skill) => skill.id === id);
}

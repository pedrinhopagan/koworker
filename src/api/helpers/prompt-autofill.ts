import { rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { COMPLEXITY_LABELS, STAGE_AGENT, type TaskComplexity } from "@/constants/complexity";
import { PROMPT_TEMPLATES } from "@/constants/prompt-templates";
import {
	type PromptAutofillInput,
	PromptAutofillResultSchema,
	type PromptEngine,
} from "../schemas/prompt";
import { dbCategories } from "../db/categories";
import { dbProjects } from "../db/projects";
import { dbTasks } from "../db/tasks";
import { spawnCapture } from "./spawn";
import { PRIMARY_FILE, readTaskFolderMeta } from "./task-folder";

const TIMEOUT_MS = 60_000;

// Descrição dos templates para o agente: cada slug com o hint e as chaves de campo exatas que o JSON
// de saída deve usar (o corpo do prompt só lê essas chaves). Deriva de PROMPT_TEMPLATES — a fonte
// única dos campos.
function describeTemplates(): string {
	return PROMPT_TEMPLATES.map((template) => {
		const fields = template.fields
			.map((field) => `"${field.key}" (${field.label}: ${field.placeholder})`)
			.join(", ");
		return `- ${template.slug} — ${template.hint}. Campos: ${fields}.`;
	}).join("\n");
}

// Mapa etapa→agente linearizado para o agente sugerir invocações coerentes com o fluxo.
function describeStageAgents(): string {
	return Object.entries(STAGE_AGENT)
		.map(([stage, agent]) => `${stage} → ${agent}`)
		.join(", ");
}

// Contexto da tarefa aberta (quando há taskId): título, complexidade, categoria, arquivos e o
// index.md inteiro. O agente lê daqui, não do banco. Sem tarefa (ou tarefa/projeto ausente), devolve
// string vazia e o cwd do backend.
async function buildTaskContext(
	taskId: string | undefined,
): Promise<{ context: string; cwd: string }> {
	if (!taskId) return { context: "", cwd: process.cwd() };

	const row = await dbTasks.getById(taskId);
	if (!row) return { context: "", cwd: process.cwd() };

	const project = await dbProjects.getById(row.project_id);
	if (!project) return { context: "", cwd: process.cwd() };

	const [category, meta] = await Promise.all([
		row.category_id ? dbCategories.getById(row.category_id) : null,
		readTaskFolderMeta({ projectRoute: project.main_route, folderPath: row.folder_path }),
	]);

	const indexPath = join(project.main_route, row.folder_path, PRIMARY_FILE);
	const indexFile = Bun.file(indexPath);
	const indexContent = (await indexFile.exists()) ? await indexFile.text() : "";

	const lines = [
		"Contexto da tarefa aberta:",
		`- Título: ${row.title?.trim() || "(sem título)"}`,
		`- Complexidade: ${COMPLEXITY_LABELS[row.complexity as TaskComplexity]}`,
		`- Categoria: ${category?.name ?? "(sem categoria)"}`,
		`- Arquivos: ${meta.fileNames.length > 0 ? meta.fileNames.join(", ") : "(nenhum)"}`,
		"",
		"Conteúdo de index.md:",
		indexContent.trim() || "(vazio)",
	];

	return { context: lines.join("\n"), cwd: project.main_route };
}

// Prompt único enviado ao motor (mesmo texto pros dois engines). Descreve os templates, o mapa
// etapa→agente e exige JSON puro no shape da saída, com o contexto e a instrução do usuário.
function buildAutofillPrompt(params: { userText: string; context: string }): string {
	return [
		"Você preenche a estrutura de um prompt de trabalho a partir de uma instrução em linguagem livre.",
		"Escolha a estrutura mais adequada e preencha apenas os campos dela, com conteúdo derivado da instrução (não invente escopo).",
		"",
		"Estruturas disponíveis:",
		describeTemplates(),
		"",
		`Agentes por etapa de fluxo (sugira em "invocations" quando a instrução pedir um passo do fluxo): ${describeStageAgents()}. Skills também podem ser sugeridas por slug.`,
		"",
		params.context,
		"",
		"Instrução do usuário:",
		params.userText,
		"",
		'Responda SOMENTE com JSON puro, sem cercas de código nem texto ao redor, no formato: {"structure":"<slug>","fields":{"<chave>":"<valor>"},"invocations":[{"kind":"agent"|"skill","slug":"<slug>"}]}.',
		'Use as chaves de campo exatas da estrutura escolhida. "invocations" pode ser [].',
	].join("\n");
}

// Extrai o primeiro objeto JSON de um texto que pode vir cercado por ```json ou prosa. Falha vira
// erro legível a montante.
function parseAutofillOutput(raw: string) {
	const start = raw.indexOf("{");
	const end = raw.lastIndexOf("}");
	if (start === -1 || end === -1 || end < start) {
		throw new ORPCError("BAD_REQUEST", { message: "O motor não devolveu JSON reconhecível" });
	}

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw.slice(start, end + 1));
	} catch {
		throw new ORPCError("BAD_REQUEST", { message: "O motor devolveu JSON inválido" });
	}

	const result = PromptAutofillResultSchema.safeParse(parsed);
	if (!result.success) {
		throw new ORPCError("BAD_REQUEST", {
			message: "A saída do motor não bate com o formato esperado",
		});
	}

	return result.data;
}

// Roda o motor com o teto curto do autofill (60s) e traduz o estouro em erro legível. As etapas
// longas de fluxo usam `spawnCapture` direto com um teto próprio.
async function spawnWithTimeout(
	cmd: string[],
	cwd: string,
): Promise<{ stdout: string; exitCode: number }> {
	const { stdout, exitCode, timedOut } = await spawnCapture({ cmd, cwd, timeoutMs: TIMEOUT_MS });
	if (timedOut) {
		throw new ORPCError("BAD_REQUEST", { message: "O motor excedeu o tempo limite de 60s" });
	}

	return { stdout, exitCode };
}

// Claude headless: `-p` com envelope JSON. O texto do modelo vive em `.result`; parseia o envelope e
// depois o resultado. Serve Opus e Sonnet — só o `--model` muda.
const ClaudeEnvelopeSchema = z.object({ result: z.string() });

async function runClaude(params: { model: string; prompt: string; cwd: string; effort: string }) {
	const { stdout, exitCode } = await spawnWithTimeout(
		[
			"claude",
			"-p",
			params.prompt,
			"--model",
			params.model,
			"--effort",
			params.effort,
			"--output-format",
			"json",
		],
		params.cwd,
	);
	if (exitCode !== 0) {
		throw new ORPCError("BAD_REQUEST", {
			message: `Falha ao executar o Claude (${params.model})`,
		});
	}

	let envelope: unknown;
	try {
		envelope = JSON.parse(stdout);
	} catch {
		throw new ORPCError("BAD_REQUEST", {
			message: "O Claude não devolveu o envelope JSON esperado",
		});
	}

	const parsed = ClaudeEnvelopeSchema.safeParse(envelope);
	if (!parsed.success) {
		throw new ORPCError("BAD_REQUEST", { message: "O envelope do Claude não tem o campo result" });
	}

	return parseAutofillOutput(parsed.data.result);
}

// GPT-5.5 headless via codex: a última mensagem do agente é escrita no arquivo `-o`. O schema
// restringe o shape da resposta; lemos o arquivo depois de o processo sair.
async function runGpt(params: { prompt: string; cwd: string; effort: string }) {
	const { prompt, cwd, effort } = params;
	const stamp = crypto.randomUUID();
	const schemaPath = join(tmpdir(), `koworker-autofill-schema-${stamp}.json`);
	const outputPath = join(tmpdir(), `koworker-autofill-out-${stamp}.txt`);

	await Bun.write(schemaPath, JSON.stringify(z.toJSONSchema(PromptAutofillResultSchema)));

	try {
		const { exitCode } = await spawnWithTimeout(
			[
				"codex",
				"exec",
				"-m",
				"gpt-5.5",
				"-c",
				`model_reasoning_effort=${effort}`,
				"--json",
				"--output-schema",
				schemaPath,
				"--ephemeral",
				"--skip-git-repo-check",
				"-C",
				cwd,
				"-o",
				outputPath,
				prompt,
			],
			cwd,
		);
		if (exitCode !== 0) {
			throw new ORPCError("BAD_REQUEST", { message: "Falha ao executar o codex (gpt-5.5)" });
		}

		const outFile = Bun.file(outputPath);
		if (!(await outFile.exists())) {
			throw new ORPCError("BAD_REQUEST", { message: "O codex não gravou a resposta" });
		}

		return parseAutofillOutput(await outFile.text());
	} finally {
		await rm(schemaPath, { force: true });
		await rm(outputPath, { force: true });
	}
}

const ENGINE_RUNNERS: Record<
	PromptEngine,
	(params: { prompt: string; cwd: string; effort: string }) => ReturnType<typeof runGpt>
> = {
	opus: (params) => runClaude({ model: "opus", ...params }),
	sonnet: (params) => runClaude({ model: "sonnet", ...params }),
	"gpt-5.5": runGpt,
};

// Ponto único do autofill: monta o contexto e o prompt, roda o motor escolhido e devolve o shape já
// validado. Erros de execução/parse sobem como ORPCError com mensagem legível.
export async function runPromptAutofill(input: PromptAutofillInput) {
	const { context, cwd } = await buildTaskContext(input.taskId);
	const prompt = buildAutofillPrompt({ userText: input.text, context });

	return ENGINE_RUNNERS[input.engine]({ prompt, cwd, effort: input.effort });
}

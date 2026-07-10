import { autoIncrement, Database } from "@lobomfz/db";
import { type } from "arktype";
import { envVariables } from "@/api/config/env";

const user_type = type.enumerated("admin", "user");

const usersSchema = type({
	id: autoIncrement(),
	name: "string",
	password: "string",
	"user_type?": user_type.configure({ default: "user" }),
});

const projectsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	name: "string",
	"description?": "string",
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	main_route: "string",
	hide_terminal: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
	"deleted_at?": "number.integer",
});

const projectRoutesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "cascade" }),
	name: "string",
	route: "string",
	"icon?": "string",
	"command?": "string",
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const tasksSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	// Pasta da task relativa ao project.main_route, ex: ".koworker/<id>-<slug>".
	// O conteúdo canônico vive nos .md dessa pasta; esta linha é só o índice.
	folder_path: "string",
	// Título editável da task. Nullable: a task pode nascer sem nome e cair no fallback
	// do primeiro .md (resolveDisplayTitle). O H1 do index.md não é mais o título.
	"title?": "string",
	// Prioridade e categoria são opcionais: a task pode nascer sem nenhuma das duas (nullable).
	// A referência e o onDelete: "restrict" seguem valendo — só não são mais obrigatórias.
	"priority_id?": type("string").configure({ references: "priorities.id", onDelete: "restrict" }),
	"category_id?": type("string").configure({ references: "categories.id", onDelete: "restrict" }),
	// Complexidade da task (conjunto finito em constants/complexity.ts). Texto com default "medio":
	// tasks existentes migram para "medio", novas nascem "medio" quando não informado.
	complexity: type("string").configure({ default: "medio" }),
	// Grupo (opcional) ao qual a task pertence. Nulo = pseudo-grupo "Sem grupo". SET NULL para
	// que deletar um grupo apenas solte as tasks de volta pro "Sem grupo".
	"group_id?": type("string").configure({ references: "task_groups.id", onDelete: "set null" }),
	// Ordem manual da task dentro do bucket (group_id + category_id).
	display_order: type("number.integer").configure({ default: 0 }),
	// Ordem manual das abas (.md) na rota da task, como array JSON de nomes. Arquivos fora
	// dessa lista (novos, criados no disco pelo agente) entram à direita por birthtime.
	"file_order?": "string",
	done: type("number.integer").configure({ default: 0 }),
	"completed_at?": "number.integer",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
	"deleted_at?": "number.integer",
});

const taskGroupsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "cascade" }),
	name: "string",
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const categoriesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	name: "string",
	color: type("string").configure({ default: "#000000" }),
	// Estrutura de prompt vinculada (slug em constants/prompt-templates.ts). Nullable: a categoria
	// pode não sugerir template. O conjunto finito é garantido na boundary zod, não no DSL de tabela.
	"structure_slug?": "string",
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const skillCategoriesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	name: "string",
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const prioritiesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	name: "string",
	level: type("number.integer").configure({ default: 1 }),
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

// Metadados internos do koworker para skills do disco. A chave é o slug da skill
// (nome da pasta), que é o que une as várias fontes num único registro. Nada aqui
// toca o SKILL.md: são apenas overrides de apresentação (nome, ícone, cor).
const skillSettingsSchema = type({
	slug: type("string").configure({ primaryKey: true }),
	"label?": "string",
	"icon?": "string",
	"color?": "string",
	"category_id?": type("string").configure({
		references: "skill_categories.id",
		onDelete: "set null",
	}),
	// Marca a skill como invocação rápida: o picker do prompt bar só lista as que têm `quick_invoke`.
	quick_invoke: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

// Caminhos do computador do usuário de onde ler skills, somados ao static interno do koworker e aos
// diretórios de cada projeto. `tool` marca a qual agent o caminho pertence (pros chips). `scope`
// distingue os roots default por plataforma (semeados na primeira execução) dos extras cadastrados
// pelo usuário — antes eram constantes no código, agora são linhas editáveis.
const skillSourcePathsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	tool: "string",
	path: "string",
	scope: type("string").configure({ default: "custom" }),
	created_at: type("number.integer").configure({ default: "now" }),
});

// Metadados internos do koworker para agents do disco. A chave é o slug do agent
// (nome do arquivo .md), que é o que une as várias fontes num único registro. Nada aqui
// toca o .md: são apenas overrides de apresentação (nome, ícone, cor).
const agentSettingsSchema = type({
	slug: type("string").configure({ primaryKey: true }),
	"label?": "string",
	"icon?": "string",
	"color?": "string",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

// Caminhos do computador do usuário de onde ler agents, somados ao static interno do koworker e aos
// diretórios de cada projeto. `tool` marca a qual ferramenta o caminho pertence (pros chips).
// `scope` distingue os roots default por plataforma (semeados na primeira execução) dos extras
// cadastrados pelo usuário — antes eram constantes no código, agora são linhas editáveis.
const agentSourcePathsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	tool: "string",
	path: "string",
	scope: type("string").configure({ default: "custom" }),
	created_at: type("number.integer").configure({ default: "now" }),
});

// Configuração de SO chave-valor: pasta base de projetos, template do emulador de terminal e
// multiplexador. Os valores são strings; o significado tipado e os defaults por plataforma vivem em
// `helpers/system-settings.ts`, a fronteira que traduz estas linhas para o shape interno.
const settingsSchema = type({
	key: type("string").configure({ primaryKey: true }),
	value: "string",
	"updated_at?": "number.integer",
});

const prompt_kind = type.enumerated("copy", "agent", "skill");

// Registro de TODO prompt despachado pela barra de prompt: copiar para o clipboard, invocar
// agent e invocar skill. Deduplicado na entrada (dbPromptHistory): redisparar um prompt idêntico
// só rebumpa o created_at da linha existente em vez de acumular duplicatas.
// SEM FK para projects: o histórico sobrevive à exclusão do projeto — por isso project_id/name são
// texto solto, capturando o estado no momento do disparo. `text` é a instrução crua do usuário;
// `prompt` é o texto final efetivamente despachado (já com `/kw <target>` ou `/<slug>`).
const promptHistorySchema = type({
	id: type("string").configure({ primaryKey: true }),
	kind: prompt_kind,
	text: "string",
	prompt: "string",
	"target?": "string",
	"agent_slug?": "string",
	"skill_slug?": "string",
	"project_id?": "string",
	"project_name?": "string",
	"route_path?": "string",
	"model?": "string",
	"effort?": "string",
	created_at: type("number.integer").configure({ default: "now" }),
});

const execution_kind = type.enumerated("prompt", "flow");
const execution_status = type.enumerated("running", "done", "failed", "timeout", "waiting_user");

const executionRunsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	user_id: type("number.integer").configure({ references: "users.id", onDelete: "cascade" }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	"task_id?": type("string").configure({ references: "tasks.id", onDelete: "set null" }),
	kind: execution_kind,
	title: "string",
	status: execution_status,
	"prompt?": "string",
	"stage?": "string",
	"agent?": "string",
	"output?": "string",
	"error?": "string",
	started_at: "number.integer",
	updated_at: "number.integer",
	"finished_at?": "number.integer",
});

const pushSubscriptionsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	user_id: type("number.integer").configure({ references: "users.id", onDelete: "cascade" }),
	endpoint: "string",
	p256dh: "string",
	auth: "string",
	"expiration_time?": "number.integer",
	created_at: "number.integer",
	updated_at: "number.integer",
});

const database = new Database({
	path: envVariables.DATABASE_URL,
	tables: {
		users: usersSchema,
		projects: projectsSchema,
		categories: categoriesSchema,
		priorities: prioritiesSchema,
		project_routes: projectRoutesSchema,
		task_groups: taskGroupsSchema,
		tasks: tasksSchema,
		skill_categories: skillCategoriesSchema,
		skill_settings: skillSettingsSchema,
		skill_source_paths: skillSourcePathsSchema,
		agent_settings: agentSettingsSchema,
		agent_source_paths: agentSourcePathsSchema,
		prompt_history: promptHistorySchema,
		execution_runs: executionRunsSchema,
		push_subscriptions: pushSubscriptionsSchema,
		settings: settingsSchema,
	},
});

import { sql } from "kysely";

sql`PRAGMA journal_mode = WAL`.execute(database.kysely);
sql`PRAGMA busy_timeout = 5000`.execute(database.kysely);
sql`PRAGMA synchronous = NORMAL`.execute(database.kysely);

export const db = database.kysely;

export type DB = typeof database.infer;

export type users = DB["users"];
export type projects = DB["projects"];
export type project_routes = DB["project_routes"];
export type tasks = DB["tasks"];
export type task_groups = DB["task_groups"];
export type categories = DB["categories"];
export type priorities = DB["priorities"];
export type skill_categories = DB["skill_categories"];
export type skill_settings = DB["skill_settings"];
export type skill_source_paths = DB["skill_source_paths"];
export type agent_settings = DB["agent_settings"];
export type agent_source_paths = DB["agent_source_paths"];
export type prompt_history = DB["prompt_history"];
export type execution_runs = DB["execution_runs"];
export type push_subscriptions = DB["push_subscriptions"];
export type settings = DB["settings"];

export {
	user_type,
	usersSchema,
	projectsSchema,
	projectRoutesSchema,
	taskGroupsSchema,
	tasksSchema,
	categoriesSchema,
	prioritiesSchema,
	skillCategoriesSchema,
	skillSettingsSchema,
	skillSourcePathsSchema,
	agentSettingsSchema,
	agentSourcePathsSchema,
	promptHistorySchema,
	executionRunsSchema,
	pushSubscriptionsSchema,
	settingsSchema,
};

import { autoIncrement, Database } from "@lobomfz/db";
import { type } from "arktype";
import { envVariables } from "@/api/config/env";

const user_type = type.enumerated("admin", "user");

const usersSchema = type({
	id: autoIncrement(),
	name: "string",
	password: "string",
	"user_type?": user_type.configure({ default: "user" }),
	"session_epoch?": type("number.integer").configure({ default: 0 }),
});

const projectsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	name: "string",
	"description?": "string",
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	main_route: "string",
	hide_terminal: type("number.integer").configure({ default: 0 }),
	task_layout_version: type("number.integer").configure({ default: 1 }),
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
	"storage_key?": "string",
	"storage_slug?": "string",
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
	"merge_ready_at?": "number.integer",
	"worktree_branch?": "string",
	"merge_target_branch?": "string",
	"worktree_path?": "string",
	"worktree_pr_url?": "string",
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
	"storage_key?": "string",
	"storage_slug?": "string",
	color: type("string").configure({ default: "#000000" }),
	display_order: type("number.integer").configure({ default: 0 }),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const task_storage_status = type.enumerated(
	"planned",
	"backed_up",
	"applying_fs",
	"committed_db",
	"verified",
	"completed",
	"blocked",
	"rollback_required",
	"rolled_back",
);

const taskStorageRunsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	plan_hash: "string",
	from_layout_version: "number.integer",
	to_layout_version: "number.integer",
	status: task_storage_status,
	manifest: "string",
	"backup_path?": "string",
	"lock_owner?": "string",
	"error?": "string",
	created_at: type("number.integer").configure({ default: "now" }),
	updated_at: "number.integer",
	"completed_at?": "number.integer",
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
const execution_status = type.enumerated(
	"running",
	"done",
	"failed",
	"timeout",
	"waiting_user",
	"cancelled",
);

const agent_session_status = type.enumerated("live", "ended", "crashed");

// Sessão de agente: o processo do CLI que fica de pé entre turnos. A linha é a identidade estável da
// conversa — `id` é o `--session-id` passado ao CLI, então retomar é `--resume <id>` na mesma linha.
// `cwd` é congelado no start: uma sessão retomada nunca troca de diretório, mesmo que o projeto mude.
const agentSessionsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	user_id: type("number.integer").configure({ references: "users.id", onDelete: "cascade" }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	"task_id?": type("string").configure({ references: "tasks.id", onDelete: "set null" }),
	title: "string",
	cli: "string",
	// Id da conversa no CLI quando ele gera o seu: o `claude` aceita o `id` desta linha, mas o
	// `codex` batiza a thread por conta própria e é este valor que o `resume` exige.
	"cli_session_id?": "string",
	cwd: "string",
	"model?": "string",
	"effort?": "string",
	"agent?": "string",
	permission_mode: type("string").configure({ default: "acceptEdits" }),
	status: agent_session_status,
	"pid?": "number.integer",
	started_at: type("number.integer").configure({ default: "now" }),
	updated_at: "number.integer",
	"heartbeat_at?": "number.integer",
	"ended_at?": "number.integer",
	"end_reason?": "string",
	"deleted_at?": "number.integer",
});

const agent_event_kind = type.enumerated(
	"user",
	"assistant",
	"thinking",
	"tool_use",
	"tool_result",
	"permission",
	"question",
	"notice",
	"result",
);

// Cada bloco da conversa. `seq` ordena dentro da sessão e é a identidade que o front usa para juntar
// o que chega pelo WebSocket com o que veio da leitura inicial. `payload` é JSON com o shape de cada
// `kind` (src/lib/agent-session.ts é a fronteira que valida na leitura).
const agentEventsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	session_id: type("string").configure({
		references: "agent_sessions.id",
		onDelete: "cascade",
	}),
	"run_id?": type("string").configure({ references: "execution_runs.id", onDelete: "set null" }),
	seq: "number.integer",
	kind: agent_event_kind,
	payload: "string",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const executionRunsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	user_id: type("number.integer").configure({ references: "users.id", onDelete: "cascade" }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	"task_id?": type("string").configure({ references: "tasks.id", onDelete: "set null" }),
	"session_id?": type("string").configure({
		references: "agent_sessions.id",
		onDelete: "set null",
	}),
	"client_request_id?": "string",
	"request_fingerprint?": "string",
	"parent_run_id?": type("string").configure({
		references: "execution_runs.id",
		onDelete: "set null",
	}),
	"cli_session_id?": "string",
	"create_task_title?": "string",
	kind: execution_kind,
	title: "string",
	status: execution_status,
	"prompt?": "string",
	"original_prompt?": "string",
	"source?": "string",
	"interaction_mode?": "string",
	"input_kind?": "string",
	"cli?": "string",
	"permission_mode?": "string",
	"model?": "string",
	"effort?": "string",
	"approval_mode?": "string",
	"stage?": "string",
	"agent?": "string",
	"output?": "string",
	"error?": "string",
	started_at: "number.integer",
	updated_at: "number.integer",
	"heartbeat_at?": "number.integer",
	"finished_at?": "number.integer",
	"deleted_at?": "number.integer",
});

const device_status = type.enumerated("pending", "approved", "blocked");

// Cada navegador/app que já pediu sessão. A identidade é o cookie de dispositivo (assinado), não o
// IP: o celular troca de rede o tempo todo. `status` é o portão — só `approved` alcança as rotas
// protegidas, e a aprovação só é concedida de dentro da máquina (loopback).
const devicesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	user_id: type("number.integer").configure({ references: "users.id", onDelete: "cascade" }),
	name: "string",
	"user_agent?": "string",
	status: device_status,
	"first_ip?": "string",
	"last_ip?": "string",
	created_at: type("number.integer").configure({ default: "now" }),
	last_seen_at: "number.integer",
	"approved_at?": "number.integer",
	"blocked_at?": "number.integer",
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
		task_storage_runs: taskStorageRunsSchema,
		skill_categories: skillCategoriesSchema,
		skill_settings: skillSettingsSchema,
		skill_source_paths: skillSourcePathsSchema,
		agent_settings: agentSettingsSchema,
		agent_source_paths: agentSourcePathsSchema,
		prompt_history: promptHistorySchema,
		agent_sessions: agentSessionsSchema,
		execution_runs: executionRunsSchema,
		agent_events: agentEventsSchema,
		push_subscriptions: pushSubscriptionsSchema,
		devices: devicesSchema,
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
export type task_storage_runs = DB["task_storage_runs"];
export type categories = DB["categories"];
export type priorities = DB["priorities"];
export type skill_categories = DB["skill_categories"];
export type skill_settings = DB["skill_settings"];
export type skill_source_paths = DB["skill_source_paths"];
export type agent_settings = DB["agent_settings"];
export type agent_source_paths = DB["agent_source_paths"];
export type prompt_history = DB["prompt_history"];
export type agent_sessions = DB["agent_sessions"];
export type agent_events = DB["agent_events"];
export type execution_runs = DB["execution_runs"];
export type push_subscriptions = DB["push_subscriptions"];
export type devices = DB["devices"];
export type settings = DB["settings"];

export {
	user_type,
	usersSchema,
	projectsSchema,
	projectRoutesSchema,
	taskGroupsSchema,
	task_storage_status,
	taskStorageRunsSchema,
	tasksSchema,
	categoriesSchema,
	prioritiesSchema,
	skillCategoriesSchema,
	skillSettingsSchema,
	skillSourcePathsSchema,
	agentSettingsSchema,
	agentSourcePathsSchema,
	promptHistorySchema,
	agent_session_status,
	agentSessionsSchema,
	agent_event_kind,
	agentEventsSchema,
	executionRunsSchema,
	pushSubscriptionsSchema,
	device_status,
	devicesSchema,
	settingsSchema,
};

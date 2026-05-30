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
	priority_id: type("string").configure({ references: "priorities.id", onDelete: "restrict" }),
	category_id: type("string").configure({ references: "categories.id", onDelete: "restrict" }),
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

// Fonte única de verdade do que é colocado no tempo. Evento pessoal puro → task_id null;
// "linkar tarefa a data/horário" → uma linha referenciando a task.
//
// IMPORTANTE — semântica de start_at/end_at: wall-clock naive-local 'YYYY-MM-DDTHH:mm'
// (zero-padded, largura fixa). NÃO são instantes UTC apesar do sufixo _at. Intervalo
// half-open [start, end): end é exclusivo e sempre carrega a própria data. O formato
// fixed-width garante ordenação lexicográfica == cronológica, então as queries de
// intervalo no SQLite são comparação direta de string contra bounds datetime completos.
//
// created_at/updated_at: epoch-ms gravados via Date.now() no boundary (dbEvents). NÃO
// confiar no default "now" do arktype, que grava segundos.
const eventsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	"title?": "string",
	start_at: "string",
	end_at: "string",
	all_day: type("number.integer").configure({ default: 0 }),
	"task_id?": type("string").configure({ references: "tasks.id", onDelete: "cascade" }),
	"color?": "string",
	"icon?": "string",
	"notes?": "string",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
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
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

// Caminhos extras do computador do usuário de onde ler skills, somados aos diretórios padrão
// dos agents. `tool` marca a qual agent o caminho pertence, pra os chips ficarem corretos.
const skillSourcePathsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	tool: "string",
	path: "string",
	created_at: type("number.integer").configure({ default: "now" }),
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
		events: eventsSchema,
		skill_settings: skillSettingsSchema,
		skill_source_paths: skillSourcePathsSchema,
	},
});

import { sql } from "kysely";

sql`PRAGMA journal_mode = WAL`.execute(database.kysely);
sql`PRAGMA busy_timeout = 5000`.execute(database.kysely);

export const db = database.kysely;

export type DB = typeof database.infer;

export type users = DB["users"];
export type projects = DB["projects"];
export type project_routes = DB["project_routes"];
export type tasks = DB["tasks"];
export type events = DB["events"];
export type task_groups = DB["task_groups"];
export type categories = DB["categories"];
export type priorities = DB["priorities"];
export type skill_settings = DB["skill_settings"];
export type skill_source_paths = DB["skill_source_paths"];

export {
	user_type,
	usersSchema,
	projectsSchema,
	projectRoutesSchema,
	taskGroupsSchema,
	tasksSchema,
	eventsSchema,
	categoriesSchema,
	prioritiesSchema,
	skillSettingsSchema,
	skillSourcePathsSchema,
};

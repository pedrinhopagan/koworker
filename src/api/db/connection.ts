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
	// YYYY-MM-DD format
	"scheduled_date?": "string",
	"scheduled_time?": "string",
	done: type("number.integer").configure({ default: 0 }),
	"completed_at?": "number.integer",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
	"deleted_at?": "number.integer",
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

const database = new Database({
	path: envVariables.DATABASE_URL,
	tables: {
		users: usersSchema,
		projects: projectsSchema,
		categories: categoriesSchema,
		priorities: prioritiesSchema,
		project_routes: projectRoutesSchema,
		tasks: tasksSchema,
		skill_settings: skillSettingsSchema,
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
export type categories = DB["categories"];
export type priorities = DB["priorities"];
export type skill_settings = DB["skill_settings"];

export {
	user_type,
	usersSchema,
	projectsSchema,
	projectRoutesSchema,
	tasksSchema,
	categoriesSchema,
	prioritiesSchema,
	skillSettingsSchema,
};

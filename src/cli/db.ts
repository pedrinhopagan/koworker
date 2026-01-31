import { homedir } from "node:os";
import { join } from "node:path";
import { autoIncrement, Database } from "@lobomfz/db";
import { type } from "arktype";

const dbPath = process.env.DATABASE_URL ?? join(homedir(), ".local/share/kowork/kowork.db");

const user_type = type.enumerated("admin", "user");
const task_status = type.enumerated("pending", "in_execution", "executed");

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
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
	"deleted_at?": "number.integer",
});

const projectRoutesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	name: "string",
	route: "string",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const tasksSchema = type({
	id: type("string").configure({ primaryKey: true }),
	project_id: type("string").configure({ references: "projects.id", onDelete: "restrict" }),
	title: "string",
	"description?": "string",
	"notes?": "string",
	"ai_metadata?": "string",
	priority_id: type("string").configure({ references: "priorities.id", onDelete: "restrict" }),
	category_id: type("string").configure({ references: "categories.id", onDelete: "restrict" }),
	status: task_status.configure({ default: "pending" }),
	"acceptance_criteria?": "string",
	"completed_at?": "number.integer",
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
	"deleted_at?": "number.integer",
});

const subtasksSchema = type({
	id: type("string").configure({ primaryKey: true }),
	task_id: type("string").configure({ references: "tasks.id", onDelete: "restrict" }),
	title: "string",
	"description?": "string",
	status: task_status.configure({ default: "pending" }),
	"completed_at?": "number.integer",
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

const database = new Database({
	path: dbPath,
	tables: {
		users: usersSchema,
		projects: projectsSchema,
		categories: categoriesSchema,
		priorities: prioritiesSchema,
		project_routes: projectRoutesSchema,
		tasks: tasksSchema,
		subtasks: subtasksSchema,
	},
});

export const db = database.kysely;

export type DB = typeof database.infer;

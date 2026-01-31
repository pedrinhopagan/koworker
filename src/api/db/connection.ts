import { autoIncrement, Database } from "@lobomfz/db";
import { type } from "arktype";
import { envVariables } from "@/api/config/env";

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
	// YYYY-MM-DD format
	"scheduled_date?": "string",
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

const executionThreadsSchema = type({
	id: type("string").configure({ primaryKey: true }),
	// 1 thread por task
	task_id: type("string").configure({
		references: "tasks.id",
		onDelete: "restrict",
		unique: true,
	}),
	created_at: type("number.integer").configure({ default: "now" }),
	"updated_at?": "number.integer",
});

const executionMessagesSchema = type({
	id: type("string").configure({ primaryKey: true }),
	thread_id: type("string").configure({
		references: "execution_threads.id",
		onDelete: "restrict",
	}),
	role: type.enumerated("user", "assistant", "system", "tool"),
	content: "string",
	"metadata?": "string",
	"model?": "string",
	"skill?": "string",
	"author_user_id?": type("number.integer").configure({
		references: "users.id",
		onDelete: "restrict",
	}),
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
		tasks: tasksSchema,
		subtasks: subtasksSchema,
		execution_threads: executionThreadsSchema,
		execution_messages: executionMessagesSchema,
	},
});

export const db = database.kysely;

export type DB = typeof database.infer;

export type users = DB["users"];
export type projects = DB["projects"];
export type project_routes = DB["project_routes"];
export type tasks = DB["tasks"];
export type subtasks = DB["subtasks"];
export type categories = DB["categories"];
export type priorities = DB["priorities"];
export type execution_threads = DB["execution_threads"];
export type execution_messages = DB["execution_messages"];

export {
	user_type,
	task_status,
	usersSchema,
	projectsSchema,
	projectRoutesSchema,
	tasksSchema,
	subtasksSchema,
	categoriesSchema,
	prioritiesSchema,
	executionThreadsSchema,
	executionMessagesSchema,
};

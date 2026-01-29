import { type } from "arktype";
import { Database, autoIncrement } from "@lobomfz/db";
import { envVariables } from "@/api/config/env";

const user_type = type.enumerated("admin", "user");

const usersSchema = type({
	id: autoIncrement(),
	name: "string",
	password: "string",
	"user_type?": user_type.configure({ default: "user" }),
});

const database = new Database({
	path: envVariables.DATABASE_URL,
	tables: {
		users: usersSchema,
	},
});

export const db = database.kysely;

export type DB = typeof database.infer;

export type users = DB["users"];

export { user_type, usersSchema };

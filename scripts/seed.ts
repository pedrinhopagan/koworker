import { db } from "../src/api/db/connection";

const createId = () => crypto.randomUUID();
const now = Date.now();

await db
	.insertInto("users")
	.values({
		name: "admin",
		password: Bun.password.hashSync("password"),
	})
	.execute();

await db
	.insertInto("categories")
	.values([
		{ id: createId(), name: "feature", color: "#22c55e", created_at: now },
		{ id: createId(), name: "fix", color: "#ef4444", created_at: now },
		{ id: createId(), name: "test", color: "#3b82f6", created_at: now },
		{ id: createId(), name: "doc", color: "#a855f7", created_at: now },
	])
	.execute();

await db
	.insertInto("priorities")
	.values([
		{ id: createId(), name: "Alta", color: "#ef4444", created_at: now },
		{ id: createId(), name: "Media", color: "#f59e0b", created_at: now },
		{ id: createId(), name: "Baixa", color: "#22c55e", created_at: now },
	])
	.execute();

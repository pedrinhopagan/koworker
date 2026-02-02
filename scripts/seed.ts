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
		{ id: createId(), name: "feature", color: "#22c55e", display_order: 0, created_at: now },
		{ id: createId(), name: "fix", color: "#ef4444", display_order: 1, created_at: now },
		{ id: createId(), name: "test", color: "#3b82f6", display_order: 2, created_at: now },
		{ id: createId(), name: "doc", color: "#a855f7", display_order: 3, created_at: now },
	])
	.execute();

await db
	.insertInto("priorities")
	.values([
		{ id: createId(), name: "Alta", level: 1, color: "#ef4444", display_order: 0, created_at: now },
		{
			id: createId(),
			name: "Media",
			level: 2,
			color: "#f59e0b",
			display_order: 1,
			created_at: now,
		},
		{
			id: createId(),
			name: "Baixa",
			level: 3,
			color: "#22c55e",
			display_order: 2,
			created_at: now,
		},
	])
	.execute();

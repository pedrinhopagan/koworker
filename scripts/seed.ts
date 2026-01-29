import { db } from "../src/api/db/connection";

const createId = () => crypto.randomUUID();

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
		{ id: createId(), name: "feature" },
		{ id: createId(), name: "fix" },
		{ id: createId(), name: "test" },
		{ id: createId(), name: "doc" },
	])
	.execute();

await db
	.insertInto("priorities")
	.values([
		{ id: createId(), name: "Alta" },
		{ id: createId(), name: "Media" },
		{ id: createId(), name: "Baixa" },
	])
	.execute();

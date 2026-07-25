import { envVariables } from "../src/api/config/env";
import { db } from "../src/api/db/connection";
import { DEFAULT_CATEGORIES } from "../src/constants/categories";

const createId = () => crypto.randomUUID();
const now = Date.now();

const normalizeName = (value: string) =>
	value
		.normalize("NFD")
		.replaceAll(/[\u0300-\u036F]/g, "")
		.trim()
		.toLowerCase();

async function seedAdminUser() {
	const adminUser = envVariables.KOWORK_ADMIN_USER;
	const adminPassword = envVariables.KOWORK_ADMIN_PASSWORD;

	if (!adminUser || !adminPassword) {
		console.warn(
			"[seed] KOWORK_ADMIN_USER e KOWORK_ADMIN_PASSWORD não definidas — usuário admin não criado.",
		);
		return;
	}

	const existing = await db
		.selectFrom("users")
		.select(["id"])
		.where("name", "=", adminUser)
		.executeTakeFirst();

	if (existing) {
		return;
	}

	await db
		.insertInto("users")
		.values({
			name: adminUser,
			password: await Bun.password.hash(adminPassword),
			user_type: "admin",
		})
		.execute();
}

await seedAdminUser();

const existingCategories = await db.selectFrom("categories").select(["name"]).execute();
const existingCategoryNames = new Set(existingCategories.map((item) => normalizeName(item.name)));

const categoriesToInsert = DEFAULT_CATEGORIES.filter(
	(item) => !existingCategoryNames.has(normalizeName(item.name)),
).map((item, index) => ({
	id: createId(),
	name: item.name,
	color: item.color,
	structure_slug: item.structureSlug,
	display_order: index,
	created_at: now,
}));

if (categoriesToInsert.length > 0) {
	await db.insertInto("categories").values(categoriesToInsert).execute();
}

const defaultPriorities = [
	{ name: "Alta", level: 1, color: "#ef4444" },
	{ name: "Media", level: 2, color: "#f59e0b" },
	{ name: "Baixa", level: 3, color: "#22c55e" },
];

const existingPriorities = await db.selectFrom("priorities").select(["name"]).execute();
const existingPriorityNames = new Set(existingPriorities.map((item) => normalizeName(item.name)));

const prioritiesToInsert = defaultPriorities
	.filter((item) => !existingPriorityNames.has(normalizeName(item.name)))
	.map((item, index) => ({
		id: createId(),
		name: item.name,
		level: item.level,
		color: item.color,
		display_order: index,
		created_at: now,
	}));

if (prioritiesToInsert.length > 0) {
	await db.insertInto("priorities").values(prioritiesToInsert).execute();
}

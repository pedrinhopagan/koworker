import { envVariables } from "../src/api/config/env";
import { db } from "../src/api/db/connection";

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

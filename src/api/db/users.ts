import { envVariables } from "@/api/config/env";
import { db } from "./connection";

export const DbUsers = {
	getById(id: number) {
		return db.selectFrom("users").where("id", "=", id).selectAll().executeTakeFirst();
	},

	getByName(name: string) {
		return db.selectFrom("users").where("name", "=", name).selectAll().executeTakeFirst();
	},

	async ensureDefaultUser() {
		const adminUser = envVariables.KOWORK_ADMIN_USER;
		const adminPassword = envVariables.KOWORK_ADMIN_PASSWORD;

		if (adminUser && adminPassword) {
			const existing = await db
				.selectFrom("users")
				.where("name", "=", adminUser)
				.selectAll()
				.executeTakeFirst();

			if (existing) {
				const passwordMatch = await Bun.password.verify(adminPassword, existing.password);
				if (!passwordMatch) {
					await db
						.updateTable("users")
						.set({ password: await Bun.password.hash(adminPassword) })
						.where("id", "=", existing.id)
						.execute();
				}
			} else {
				await db
					.insertInto("users")
					.values({
						name: adminUser,
						password: await Bun.password.hash(adminPassword),
						user_type: "admin",
					})
					.execute();
			}

			if (adminUser !== "admin") {
				const legacyAdmin = await db
					.selectFrom("users")
					.where("name", "=", "admin")
					.select(["id"])
					.executeTakeFirst();

				if (legacyAdmin) {
					await db.deleteFrom("users").where("id", "=", legacyAdmin.id).execute();
				}
			}

			return;
		}

		const result = await db
			.selectFrom("users")
			.select(db.fn.countAll<number>().as("total"))
			.executeTakeFirst();
		const total = Number(result?.total ?? 0);

		if (total === 0) {
			console.warn(
				"[kowork] Nenhum usuário no banco. Defina KOWORK_ADMIN_USER e KOWORK_ADMIN_PASSWORD para criar o admin.",
			);
		}
	},
};

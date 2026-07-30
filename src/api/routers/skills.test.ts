import { expect, test } from "bun:test";
import { call, ORPCError } from "@orpc/server";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "skills-router-test-secret";
process.env.NODE_ENV = "development";

test("deleteAll preserva a mensagem da falha no limite da API", async () => {
	const { skillsRouter } = await import("./skills");
	let error: unknown;

	try {
		await call(
			skillsRouter.deleteAll,
			{ slug: "skill-inexistente" },
			{
				context: {
					user: {
						id: 1,
						name: "Teste",
						password: "teste",
						user_type: "admin",
						session_epoch: 0,
					},
					device: {
						id: "device-teste",
						user_id: 1,
						name: "Teste",
						status: "approved",
						user_agent: null,
						first_ip: null,
						last_ip: null,
						created_at: 0,
						last_seen_at: 0,
						approved_at: 0,
						blocked_at: null,
					},
				},
			},
		);
	} catch (err) {
		error = err;
	}

	expect(error).toBeInstanceOf(ORPCError);
	expect(error).toMatchObject({
		code: "CONFLICT",
		message: "Skill não encontrada",
	});
});

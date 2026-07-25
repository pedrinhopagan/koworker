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
				},
			},
		);
	} catch (err) {
		error = err;
	}

	expect(error).toBeInstanceOf(ORPCError);
	expect(error).toMatchObject({
		code: "INTERNAL_SERVER_ERROR",
		message: "Skill não encontrada",
	});
});

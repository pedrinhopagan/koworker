import { expect, test } from "bun:test";
import { call, ORPCError } from "@orpc/server";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "device-test-secret";
process.env.NODE_ENV = "development";

const { deviceNameFromUserAgent } = await import("./device");
const { localProcedure, protectedProcedure } = await import("./context");

const user = {
	id: 1,
	name: "Teste",
	password: "teste",
	user_type: "user" as const,
	session_epoch: 0,
};

function device(status: "pending" | "approved" | "blocked") {
	return {
		id: "device-1",
		user_id: 1,
		name: "Celular",
		status,
		user_agent: null,
		first_ip: null,
		last_ip: null,
		created_at: 0,
		last_seen_at: 0,
		approved_at: null,
		blocked_at: null,
	};
}

const ping = protectedProcedure.handler(() => "ok");
const manage = localProcedure.handler(() => "ok");

test("nomeia o dispositivo pelo user agent", () => {
	expect(deviceNameFromUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Safari/605")).toBe(
		"iPhone · Safari",
	);
	expect(deviceNameFromUserAgent(null)).toBe("Dispositivo desconhecido");
});

test("dispositivo aprovado passa pela rota protegida", async () => {
	expect(await call(ping, undefined, { context: { user, device: device("approved") } })).toBe("ok");
});

for (const status of ["pending", "blocked"] as const) {
	test(`dispositivo ${status} não alcança rota protegida`, async () => {
		const error = await call(ping, undefined, {
			context: { user, device: device(status) },
		}).catch((err: unknown) => err);

		expect(error).toBeInstanceOf(ORPCError);
		expect(error).toMatchObject({ code: "FORBIDDEN" });
	});
}

test("sessão sem dispositivo não alcança rota protegida", async () => {
	const error = await call(ping, undefined, { context: { user, device: null } }).catch(
		(err: unknown) => err,
	);

	expect(error).toMatchObject({ code: "FORBIDDEN" });
});

test("gerenciar dispositivo exige requisição de dentro da máquina", async () => {
	const context = { user, device: device("approved"), reqHeaders: new Headers() };

	const allowed = await call(manage, undefined, {
		context: { ...context, remoteAddress: "127.0.0.1" },
	});

	expect(allowed).toBe("ok");

	const error = await call(manage, undefined, {
		context: { ...context, remoteAddress: "192.168.0.30" },
	}).catch((err: unknown) => err);

	expect(error).toMatchObject({ code: "FORBIDDEN" });
});

test("proxy reverso nunca conta como máquina local", async () => {
	const reqHeaders = new Headers({ "x-forwarded-for": "127.0.0.1" });

	const error = await call(manage, undefined, {
		context: { user, device: device("approved"), reqHeaders, remoteAddress: "127.0.0.1" },
	}).catch((err: unknown) => err);

	expect(error).toMatchObject({ code: "FORBIDDEN" });
});

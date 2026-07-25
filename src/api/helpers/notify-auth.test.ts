import { describe, expect, test } from "bun:test";

import { isNotifyAuthorized } from "./notify-auth";

describe("isNotifyAuthorized sem token configurado", () => {
	test("aceita o socket de loopback", () => {
		expect(
			isNotifyAuthorized({
				headers: new Headers(),
				remoteAddress: "127.0.0.1",
				notifyToken: undefined,
			}),
		).toBe(true);

		expect(
			isNotifyAuthorized({
				headers: new Headers(),
				remoteAddress: "::1",
				notifyToken: undefined,
			}),
		).toBe(true);
	});

	test("recusa endereço remoto mesmo com Host forjado", () => {
		expect(
			isNotifyAuthorized({
				headers: new Headers({ host: "localhost:2841" }),
				remoteAddress: "192.168.0.42",
				notifyToken: undefined,
			}),
		).toBe(false);
	});

	test("recusa quando não há endereço de socket", () => {
		expect(
			isNotifyAuthorized({
				headers: new Headers({ host: "localhost" }),
				remoteAddress: null,
				notifyToken: undefined,
			}),
		).toBe(false);
	});

	test("recusa requisição repassada por proxy reverso", () => {
		for (const header of ["x-forwarded-for", "x-forwarded-host", "x-real-ip", "forwarded"]) {
			expect(
				isNotifyAuthorized({
					headers: new Headers({ [header]: "203.0.113.7" }),
					remoteAddress: "127.0.0.1",
					notifyToken: undefined,
				}),
			).toBe(false);
		}
	});
});

describe("isNotifyAuthorized com token configurado", () => {
	test("aceita o token da kw-cli no Authorization e no header próprio", () => {
		expect(
			isNotifyAuthorized({
				headers: new Headers({ authorization: "Bearer segredo" }),
				remoteAddress: "203.0.113.7",
				notifyToken: "segredo",
			}),
		).toBe(true);

		expect(
			isNotifyAuthorized({
				headers: new Headers({ "x-kowork-token": "segredo" }),
				remoteAddress: "203.0.113.7",
				notifyToken: "segredo",
			}),
		).toBe(true);
	});

	test("recusa token ausente ou divergente, mesmo vindo do loopback", () => {
		expect(
			isNotifyAuthorized({
				headers: new Headers(),
				remoteAddress: "127.0.0.1",
				notifyToken: "segredo",
			}),
		).toBe(false);

		expect(
			isNotifyAuthorized({
				headers: new Headers({ authorization: "Bearer outro" }),
				remoteAddress: "127.0.0.1",
				notifyToken: "segredo",
			}),
		).toBe(false);
	});
});

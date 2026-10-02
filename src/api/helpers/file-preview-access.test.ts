import { expect, test } from "bun:test";
import { SignJWT } from "jose";

process.env.DATABASE_URL = ":memory:";
process.env.JWT_SECRET = "session-test-secret";
process.env.NODE_ENV = "development";

const { SECRET, verifySessionToken } = await import("../auth/session");
const { createFilePreviewToken, verifyFilePreviewToken } = await import("./file-preview-access");

const claims = { directory: "/project/docs", viewer: 1, device: "device", epoch: 2 };

test("credencial de preview é restrita e não serve como sessão do aplicativo", async () => {
	const token = await createFilePreviewToken(claims);
	const verified = await verifyFilePreviewToken(token);
	expect(verified).toEqual(claims);
	expect(await verifySessionToken(token)).toBeNull();
	expect(await verifyFilePreviewToken(`${token}invalid`)).toBeNull();
});

test("preview recusa credenciais expiradas, de outra finalidade e sem escopo", async () => {
	for (const token of [
		await new SignJWT(claims)
			.setProtectedHeader({ alg: "HS256" })
			.setAudience("kowork-file-preview")
			.setExpirationTime(0)
			.sign(SECRET),
		await new SignJWT(claims)
			.setProtectedHeader({ alg: "HS256" })
			.setAudience("other")
			.setExpirationTime("1h")
			.sign(SECRET),
		await new SignJWT({ viewer: 1 })
			.setProtectedHeader({ alg: "HS256" })
			.setAudience("kowork-file-preview")
			.setExpirationTime("1h")
			.sign(SECRET),
	]) {
		expect(await verifyFilePreviewToken(token)).toBeNull();
	}
});

import { type } from "arktype";
import * as jose from "jose";
import { envVariables } from "@/api/config/env";

const SECRET = new TextEncoder().encode(envVariables.JWT_SECRET);

const tokenPayloadSchema = type({
	userId: "number",
});

export type TokenPayload = typeof tokenPayloadSchema.infer;

export const JWT = {
	create(payload: TokenPayload) {
		return new jose.SignJWT({ ...payload })
			.setProtectedHeader({ alg: "HS256" })
			.setExpirationTime("7d")
			.sign(SECRET);
	},

	async verify(token: string) {
		try {
			const { payload } = await jose.jwtVerify(token, SECRET);
			return tokenPayloadSchema.assert(payload);
		} catch {
			return null;
		}
	},
};

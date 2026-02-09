import { ORPCError } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import { envVariables } from "@/api/config/env";
import { DbUsers } from "@/api/db/users";
import type { AuthLoginInput } from "@/api/schemas/auth";
import { JWT } from "./jwt";

function shouldUseSecureCookie(reqHeaders: Headers | undefined): boolean {
	const origin = reqHeaders?.get("origin") || "";
	const host = reqHeaders?.get("host") || "";
	const candidate = `${origin} ${host}`.toLowerCase();

	if (
		candidate.includes("localhost") ||
		candidate.includes("127.0.0.1") ||
		candidate.includes("[::1]")
	) {
		return false;
	}

	const forwardedProto = reqHeaders?.get("x-forwarded-proto");
	if (forwardedProto) {
		return forwardedProto.toLowerCase() === "https";
	}

	if (origin) {
		try {
			return new URL(origin).protocol === "https:";
		} catch {
			return envVariables.NODE_ENV === "production";
		}
	}

	return envVariables.NODE_ENV === "production";
}

export const Auth = {
	async login(
		input: AuthLoginInput,
		resHeaders: Headers | undefined,
		reqHeaders: Headers | undefined,
	) {
		const user = await DbUsers.getByName(input.name);

		if (!user) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const passwordMatch = await Bun.password.verify(input.password, user.password);

		if (!passwordMatch) {
			throw new ORPCError("UNAUTHORIZED");
		}

		const token = await JWT.create({ userId: user.id });

		setCookie(resHeaders, "session", token, {
			httpOnly: true,
			secure: shouldUseSecureCookie(reqHeaders),
			sameSite: "lax",
			maxAge: 7 * 24 * 60 * 60,
			path: "/",
		});

		return { id: user.id, name: user.name };
	},

	logout(resHeaders: Headers | undefined) {
		setCookie(resHeaders, "session", "", { maxAge: 0, path: "/" });

		return { ok: true };
	},
};

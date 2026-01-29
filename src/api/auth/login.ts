import { ORPCError } from "@orpc/server";
import { setCookie } from "@orpc/server/helpers";
import { JWT } from "./jwt";
import { DbUsers } from "@/api/db/users";
import { envVariables } from "@/api/config/env";
import { EndpointSchemas } from "@/api/schemas";

export const Auth = {
  async login(input: typeof EndpointSchemas.authLogin.infer, resHeaders: Headers | undefined) {
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
      secure: envVariables.NODE_ENV === "production",
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

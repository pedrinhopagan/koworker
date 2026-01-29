import { usersSchema } from "../db/connection";

export const EndpointSchemas = {
	authLogin: usersSchema.pick("name", "password"),
};

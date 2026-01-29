import { type } from "arktype";

export const envSchema = type({
	DATABASE_URL: "string",
	JWT_SECRET: "string",
	"NODE_ENV?": "'development' | 'production'",
});

const result = envSchema(process.env);

if (result instanceof type.errors) {
	console.error("Invalid environment variables:");
	console.error(result.summary);
	process.exit(1);
}

export const envVariables = result;

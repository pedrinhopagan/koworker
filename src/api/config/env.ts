import { type } from "arktype";

export const envSchema = type({
	DATABASE_URL: "string",
	JWT_SECRET: "string",
	"NODE_ENV?": "'development' | 'production'",
	"PROJECTS_BASE_PATH?": "string",
	// O backend desktop recebe estes do `backend.rs` em runtime. Precisam estar no schema:
	// arktype roda com `onUndeclaredKey: "delete"` + `clone: false`, então validar
	// `process.env` apaga in-place qualquer chave fora daqui antes do server.ts lê-las.
	"KOWORK_PORT?": "string",
	"KOWORK_DIST_DIR?": "string",
});

const result = envSchema(process.env);

if (result instanceof type.errors) {
	console.error("Invalid environment variables:");
	console.error(result.summary);
	process.exit(1);
}

export const envVariables = result;

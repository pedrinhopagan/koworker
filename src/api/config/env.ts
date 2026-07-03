import { type } from "arktype";

export const envSchema = type({
	DATABASE_URL: "string",
	JWT_SECRET: "string",
	"NODE_ENV?": "'development' | 'production'",
	// O backend desktop recebe estes do `backend.rs` em runtime. Precisam estar no schema:
	// arktype roda com `onUndeclaredKey: "delete"` + `clone: false`, então validar
	// `process.env` apaga in-place qualquer chave fora daqui antes do server.ts lê-las.
	"KOWORK_PORT?": "string",
	"KOWORK_DIST_DIR?": "string",
	"KOWORK_ADMIN_USER?": "string",
	"KOWORK_ADMIN_PASSWORD?": "string",
	"KOWORK_ALLOWED_ORIGINS?": "string",
	"KOWORK_NOTIFY_TOKEN?": "string",
	"KOWORK_REPO_DIR?": "string",
});

const result = envSchema(process.env);

if (result instanceof type.errors) {
	console.error("Invalid environment variables:");
	console.error(result.summary);
	process.exit(1);
}

function emptyToUndefined(value: string | undefined): string | undefined {
	if (value === undefined) {
		return undefined;
	}

	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export const envVariables = {
	...result,
	KOWORK_DIST_DIR: emptyToUndefined(result.KOWORK_DIST_DIR),
};

import { type } from "arktype";

export const envSchema = type({
	DATABASE_URL: "string",
	JWT_SECRET: "string",
	"NODE_ENV?": "'development' | 'production'",
	"KOWORK_PORT?": "string",
	"KOWORK_DIST_DIR?": "string",
	"KOWORK_ADMIN_USER?": "string",
	"KOWORK_ADMIN_PASSWORD?": "string",
	"KOWORK_ALLOWED_ORIGINS?": "string",
	"KOWORK_NOTIFY_TOKEN?": "string",
	"KOWORK_REPO_DIR?": "string",
	"KOWORK_VAPID_PUBLIC_KEY?": "string",
	"KOWORK_VAPID_PRIVATE_KEY?": "string",
	"KOWORK_VAPID_SUBJECT?": "string",
	"GROQ_API_KEY?": "string",
});

// Valida uma CÓPIA: o arktype global roda com `onUndeclaredKey: "delete"` + `clone: false`, e
// validar `process.env` direto apagava in-place PATH, HOME e SHELL do processo inteiro — os spawns
// de claude/codex e o terminal herdavam um ambiente vazio e quebravam.
const result = envSchema({ ...process.env });

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

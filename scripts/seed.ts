import { db } from "../src/api/db/connection";

const createId = () => crypto.randomUUID();
const now = Date.now();

await db
	.insertInto("users")
	.values({
		name: "admin",
		password: Bun.password.hashSync("password"),
	})
	.execute();

await db
	.insertInto("categories")
	.values([
		{ id: createId(), name: "feature", color: "#22c55e", display_order: 0, created_at: now },
		{ id: createId(), name: "fix", color: "#ef4444", display_order: 1, created_at: now },
		{ id: createId(), name: "test", color: "#3b82f6", display_order: 2, created_at: now },
		{ id: createId(), name: "doc", color: "#a855f7", display_order: 3, created_at: now },
	])
	.execute();

await db
	.insertInto("priorities")
	.values([
		{ id: createId(), name: "Alta", level: 1, color: "#ef4444", display_order: 0, created_at: now },
		{
			id: createId(),
			name: "Media",
			level: 2,
			color: "#f59e0b",
			display_order: 1,
			created_at: now,
		},
		{
			id: createId(),
			name: "Baixa",
			level: 3,
			color: "#22c55e",
			display_order: 2,
			created_at: now,
		},
	])
	.execute();

await db
	.insertInto("agents")
	.values([
		{
			id: createId(),
			name: "Claude Code",
			description: "Anthropic CLI agent para desenvolvimento",
			color: "#d97706",
			display_order: 0,
			created_at: now,
		},
		{
			id: createId(),
			name: "Codex CLI",
			description: "OpenAI CLI agent para desenvolvimento",
			color: "#10b981",
			display_order: 1,
			created_at: now,
		},
		{
			id: createId(),
			name: "Gemini CLI",
			description: "Google CLI agent para desenvolvimento",
			color: "#3b82f6",
			display_order: 2,
			created_at: now,
		},
	])
	.execute();

await db
	.insertInto("models")
	.values([
		{
			id: createId(),
			name: "Claude Sonnet 4",
			provider: "Anthropic",
			model_id: "claude-sonnet-4-20250514",
			color: "#d97706",
			display_order: 0,
			created_at: now,
		},
		{
			id: createId(),
			name: "Claude Opus 4",
			provider: "Anthropic",
			model_id: "claude-opus-4-20250514",
			color: "#d97706",
			display_order: 1,
			created_at: now,
		},
		{
			id: createId(),
			name: "GPT-4.1",
			provider: "OpenAI",
			model_id: "gpt-4.1",
			color: "#10b981",
			display_order: 2,
			created_at: now,
		},
		{
			id: createId(),
			name: "o3",
			provider: "OpenAI",
			model_id: "o3",
			color: "#10b981",
			display_order: 3,
			created_at: now,
		},
		{
			id: createId(),
			name: "Gemini 2.5 Pro",
			provider: "Google",
			model_id: "gemini-2.5-pro",
			color: "#3b82f6",
			display_order: 4,
			created_at: now,
		},
	])
	.execute();

import { ORPCError } from "@orpc/server";
import type { z } from "zod";

import type { ShellSendSchema } from "@/api/schemas/shells";
import { resolveProcessTranscript } from "../agent-radar/transcript/process";
import { inspectShellAgent } from "./agent-detect";
import { shellRuntime } from "./supervisor";

export async function resolveShellTranscript(id: string) {
	const shell = shellRuntime.snapshot(id);
	if (!shell || shell.status !== "live") {
		return null;
	}

	const process = await inspectShellAgent(shell.pid);
	if (!process || (process.agent !== "claude" && process.agent !== "codex")) {
		return null;
	}

	const source = await resolveProcessTranscript(process);
	return source ? { ...source, ...(process.cwd ? { cwd: process.cwd } : {}) } : null;
}

const sending = new Set<string>();

export async function sendShellPrompt(input: z.infer<typeof ShellSendSchema>) {
	if (sending.has(input.id)) {
		throw new ORPCError("CONFLICT", { message: "Uma mensagem já está sendo enviada neste shell" });
	}

	sending.add(input.id);
	try {
		const shell = shellRuntime.snapshot(input.id);
		const process = shell?.status === "live" ? await inspectShellAgent(shell.pid) : null;
		if (!shell || !process || process.agent !== input.agent) {
			throw new ORPCError("CONFLICT", {
				message: "O agente mudou ou foi encerrado. Confira o terminal antes de enviar.",
			});
		}

		if (input.sourcePath) {
			const source = await resolveProcessTranscript(process);
			if (source?.path !== input.sourcePath) {
				throw new ORPCError("CONFLICT", {
					message: "A sessão mudou. Aguarde a conversa atualizar antes de enviar.",
				});
			}
		}

		if (
			!shellRuntime.execute({ type: "prompt", id: input.id, agent: input.agent, data: input.text })
		) {
			throw new ORPCError("CONFLICT", {
				message:
					"O terminal ainda não está pronto para receber mensagens. Abra o terminal para conferir.",
			});
		}

		await Bun.sleep(100);
		const current = await inspectShellAgent(shell.pid);
		if (
			current?.pid !== process.pid ||
			current.agent !== process.agent ||
			!shellRuntime.execute({ type: "input", id: input.id, data: "\r" })
		) {
			throw new ORPCError("CONFLICT", {
				message: "O agente foi encerrado durante o envio. Confira o terminal.",
			});
		}

		return { ok: true };
	} finally {
		sending.delete(input.id);
	}
}

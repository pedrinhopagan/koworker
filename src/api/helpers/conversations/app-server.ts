import { createInterface } from "node:readline";
import { spawn } from "node:child_process";
import { z } from "zod";
import { CONVERSATION_PROFILES } from "@/constants/conversation";
import type { ConversationProfileSchema } from "@/lib/conversation";

const envelopeSchema = z.object({
	id: z.union([z.string(), z.number()]).optional(),
	method: z.string().optional(),
	params: z.record(z.string(), z.unknown()).optional(),
	result: z.unknown().optional(),
	error: z.object({ code: z.number(), message: z.string() }).optional(),
});

export type CodexEnvelope = z.infer<typeof envelopeSchema>;

export class CodexAppServer {
	readonly runtimeId = crypto.randomUUID();
	private readonly process;
	private readonly pending = new Map<
		string | number,
		{
			resolve: (result: unknown) => void;
			reject: (error: Error) => void;
			timer: ReturnType<typeof setTimeout>;
			onResult?: (result: unknown) => Promise<void>;
		}
	>();
	private sequence = 0;
	private closed = false;
	private readonly decisions = new Map<
		string | number,
		{ resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }
	>();
	readonly ready: Promise<void>;

	constructor(
		profileId: z.infer<typeof ConversationProfileSchema>,
		private readonly onEvent: (event: CodexEnvelope) => Promise<void>,
		private readonly onExit: () => Promise<void>,
		options?: { codexHome: string },
	) {
		const profile = CONVERSATION_PROFILES.find((entry) => entry.id === profileId)!;
		this.process = spawn(profile.command, ["app-server", "--listen", "stdio://"], {
			stdio: ["pipe", "pipe", "pipe"],
			...(options ? { env: { ...process.env, CODEX_HOME: options.codexHome } } : {}),
		});
		const lines = createInterface({ input: this.process.stdout });
		lines.on("line", (line) => {
			try {
				const event = envelopeSchema.parse(JSON.parse(line));
				if (event.method === "serverRequest/resolved") {
					const requestId = z.union([z.string(), z.number()]).parse(event.params?.requestId);
					const decision = this.decisions.get(requestId);
					if (decision) {
						clearTimeout(decision.timer);
						this.decisions.delete(requestId);
						decision.resolve();
					}
				}
				if (!event.method && event.id !== undefined) {
					const pending = this.pending.get(event.id);
					if (!pending) {
						return;
					}
					clearTimeout(pending.timer);
					this.pending.delete(event.id);
					if (event.error) {
						const error = new Error(event.error.message);
						error.name = "CodexRpcError";
						pending.reject(error);
						return;
					}
					if (pending.onResult) {
						try {
							void pending
								.onResult(event.result)
								.then(() => pending.resolve(event.result), pending.reject);
						} catch (error) {
							pending.reject(error instanceof Error ? error : new Error(String(error)));
						}
					} else {
						pending.resolve(event.result);
					}
					return;
				}
				void this.onEvent(event).catch((error) =>
					console.error("Falha ao processar evento Codex:", error),
				);
			} catch (error) {
				console.error("Evento inválido do Codex App Server:", error);
			}
		});
		this.process.stderr.resume();
		this.process.stdin.on("error", () => this.fail());
		this.process.on("error", () => this.fail());
		this.process.on("exit", () => this.fail());
		this.ready = this.initialize();
	}

	private async initialize() {
		try {
			await this.call("initialize", {
				clientInfo: { name: "kowork", title: "Kowork", version: "0.1.0" },
				capabilities: { experimentalApi: true },
			});
			await this.write({ method: "initialized" });
		} catch (error) {
			this.close();
			throw error;
		}
	}

	private async write(message: object) {
		if (this.closed) {
			throw new Error("O processo do Codex foi encerrado. Reabra a conversa para retomar.");
		}
		await new Promise<void>((resolve, reject) => {
			this.process.stdin.write(`${JSON.stringify(message)}\n`, (error) => {
				if (error) {
					reject(error);
					return;
				}
				resolve();
			});
		});
	}

	async call(
		method: string,
		params: object,
		onResult?: (result: unknown) => Promise<void>,
	): Promise<unknown> {
		const id = ++this.sequence;
		return await new Promise((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error("O Codex não confirmou a operação a tempo."));
			}, 30_000);
			this.pending.set(id, { resolve, reject, timer, onResult });
			void this.write({ id, method, params }).catch((error) => {
				clearTimeout(timer);
				this.pending.delete(id);
				reject(error);
			});
		});
	}

	async respond(id: string | number, result: object) {
		if (this.decisions.has(id)) {
			throw new Error("Esta decisão já está aguardando confirmação do Codex.");
		}
		await new Promise<void>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.decisions.delete(id);
				reject(
					new Error(
						"O Codex não confirmou a decisão. Confira a conversa antes de responder novamente.",
					),
				);
			}, 15_000);
			this.decisions.set(id, { resolve, reject, timer });
			void this.write({ id, result }).catch((error) => {
				clearTimeout(timer);
				this.decisions.delete(id);
				reject(error);
			});
		});
	}

	async rejectRequest(id: string | number) {
		await this.write({
			id,
			error: { code: -32601, message: "Esta interação ainda não é suportada pelo Kowork." },
		});
	}

	private fail() {
		if (this.closed) {
			return;
		}
		this.closed = true;
		this.process.kill("SIGTERM");
		for (const pending of this.pending.values()) {
			clearTimeout(pending.timer);
			pending.reject(new Error("O processo do Codex foi encerrado."));
		}
		this.pending.clear();
		for (const decision of this.decisions.values()) {
			clearTimeout(decision.timer);
			decision.reject(new Error("O Codex foi encerrado antes de confirmar a decisão."));
		}
		this.decisions.clear();
		void this.onExit().catch((error) =>
			console.error("Falha ao registrar encerramento do Codex:", error),
		);
	}

	close() {
		this.fail();
		this.process.kill("SIGTERM");
		const timer = setTimeout(() => this.process.kill("SIGKILL"), 2000);
		timer.unref();
	}
}

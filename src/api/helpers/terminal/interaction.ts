import { ORPCError } from "@orpc/server";

const interactions = new Set<string>();
export async function withTerminalInteraction<T>(paneId: string, action: () => Promise<T>) {
	if (interactions.has(paneId)) {
		throw new ORPCError("CONFLICT", {
			message: "Uma operação já está em andamento neste terminal",
		});
	}

	interactions.add(paneId);
	try {
		return await action();
	} finally {
		interactions.delete(paneId);
	}
}

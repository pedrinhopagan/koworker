import { ORPCError } from "@orpc/client";

// Distingue "o servidor respondeu que isso não existe" de "não deu para falar com o servidor". No
// celular a segunda situação é rotina (tela bloqueada, troca de rede) e não pode ser tratada como
// registro perdido.
export function isNotFoundError(error: unknown): boolean {
	return error instanceof ORPCError && error.code === "NOT_FOUND";
}

export function errorMessage(error: unknown, fallback: string) {
	if (error instanceof ORPCError && error.code !== "INTERNAL_SERVER_ERROR" && error.message) {
		return error.message;
	}

	return fallback;
}

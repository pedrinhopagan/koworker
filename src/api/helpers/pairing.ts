// Token do QR de pareamento. Vive em memória e só: o PC está de pé enquanto o QR está na tela, e um
// restart nesse intervalo custa um QR novo, não uma tabela a mais para envelhecer.
const TOKEN_TTL_MS = 2 * 60 * 1000;

const tokens = new Map<string, { userId: number; expiresAt: number }>();

function purgeExpired() {
	const now = Date.now();

	for (const [token, entry] of tokens) {
		if (entry.expiresAt <= now) {
			tokens.delete(token);
		}
	}
}

export function createPairingToken(userId: number) {
	purgeExpired();

	const token = crypto.randomUUID().replaceAll("-", "");
	const expiresAt = Date.now() + TOKEN_TTL_MS;
	tokens.set(token, { userId, expiresAt });

	return { token, expiresAt };
}

// Uso único: o token sai do mapa na primeira leitura, então recarregar a página do celular já cai no
// login normal em vez de parear um segundo aparelho com o mesmo QR.
export function consumePairingToken(token: string) {
	purgeExpired();

	const entry = tokens.get(token);

	if (!entry) {
		return null;
	}

	tokens.delete(token);

	return entry.userId;
}

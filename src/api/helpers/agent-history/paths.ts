import { statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";

import type { HistoryCli } from "@/api/schemas/agent-history";

export type { HistoryCli } from "@/api/schemas/agent-history";

export const HISTORY_CLIS: readonly HistoryCli[] = ["claude", "codex"];

export type CliSessionFile = {
	cli: HistoryCli;
	sessionId: string;
	path: string;
	updatedAt: number;
	sizeBytes: number;
};

const SESSION_ID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.jsonl$/;

export function claudeSessionsRoot() {
	return join(homedir(), ".claude", "projects");
}

export function codexSessionsRoot() {
	return join(homedir(), ".codex", "sessions");
}

// A pasta que o claude cria por diretório de trabalho é o caminho inteiro com todo caractere fora de
// [a-zA-Z0-9] virando `-`. Não dá pra desfazer a troca, mas dá pra escolher as conversas de um
// projeto sem abrir arquivo nenhum: a pasta da raiz e as das subpastas (worktree, pacote publicado)
// começam com o mesmo prefixo.
export function claudeDirPrefix(path: string) {
	return path.replaceAll(/[^a-zA-Z0-9]/g, "-");
}

function fileEntry(cli: HistoryCli, path: string): CliSessionFile | null {
	const sessionId = SESSION_ID.exec(basename(path))?.[1];
	if (!sessionId) {
		return null;
	}

	try {
		const stat = statSync(path);

		return { cli, sessionId, path, updatedAt: stat.mtimeMs, sizeBytes: stat.size };
	} catch {
		return null;
	}
}

function scan(root: string, pattern: string) {
	try {
		return [...new Bun.Glob(pattern).scanSync({ cwd: root, absolute: true, onlyFiles: true })];
	} catch {
		return [];
	}
}

// As conversas do claude que podem ser deste projeto. Sem raiz informada são todas; com raiz, o
// prefixo da pasta já descarta as outras antes de qualquer leitura. A raiz entra em mais de uma
// forma porque o projeto pode estar cadastrado por um link simbólico e o claude grava a pasta pelo
// caminho que o terminal usou.
export function listClaudeSessionFiles(mainRoutes?: string[]): CliSessionFile[] {
	const root = claudeSessionsRoot();
	const prefixes = mainRoutes?.length ? mainRoutes.map(claudeDirPrefix) : null;

	return scan(root, "*/*.jsonl").flatMap((path) => {
		const dir = basename(path.slice(0, path.lastIndexOf("/")));
		if (prefixes && !prefixes.some((prefix) => dir === prefix || dir.startsWith(`${prefix}-`))) {
			return [];
		}

		const entry = fileEntry("claude", path);

		return entry ? [entry] : [];
	});
}

// O codex guarda tudo por data, sem pista do diretório no caminho: quem separa por projeto é o `cwd`
// do cabeçalho. Subagente e sessão derivada também caem aqui e são descartados na leitura.
export function listCodexSessionFiles(): CliSessionFile[] {
	return scan(codexSessionsRoot(), "**/rollout-*.jsonl").flatMap((path) => {
		const entry = fileEntry("codex", path);

		return entry ? [entry] : [];
	});
}

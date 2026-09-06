import { realpath, stat } from "node:fs/promises";
import { basename, dirname, extname } from "node:path";

import { ORPCError } from "@orpc/server";

import { isPathInside } from "./path-containment";

export const FILE_VIEW_TEXT_MAX_BYTES = 512 * 1024;
const IMAGE_MAX_BYTES = 4 * 1024 * 1024;
const BINARY_PROBE_BYTES = 8192;

const IMAGE_TYPES: Record<string, string> = {
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".webp": "image/webp",
	".svg": "image/svg+xml",
};

export type ViewableFile =
	| { kind: "image"; name: string; dir: string; path: string; size: number; dataUrl: string }
	| {
			kind: "text";
			name: string;
			dir: string;
			path: string;
			size: number;
			truncated: boolean;
			content: string;
	  };

export async function readViewableFile(path: string, roots: string[]): Promise<ViewableFile> {
	const target = await realpath(path).catch(() => null);
	if (!target) {
		throw new ORPCError("NOT_FOUND", { message: "Arquivo não encontrado" });
	}

	if (!roots.some((root) => isPathInside(root, target))) {
		throw new ORPCError("FORBIDDEN", { message: "Arquivo fora dos projetos cadastrados" });
	}

	const info = await stat(target);
	if (!info.isFile()) {
		throw new ORPCError("NOT_FOUND", { message: "O caminho citado não é um arquivo" });
	}

	const name = basename(target);
	const dir = dirname(target);
	const imageType = IMAGE_TYPES[extname(name).toLowerCase()];

	if (imageType) {
		if (info.size > IMAGE_MAX_BYTES) {
			throw new ORPCError("PAYLOAD_TOO_LARGE", {
				message: "Imagem grande demais para abrir no app",
			});
		}
		const bytes = await Bun.file(target).bytes();

		return {
			kind: "image",
			name,
			dir,
			path: target,
			size: info.size,
			dataUrl: `data:${imageType};base64,${Buffer.from(bytes).toString("base64")}`,
		};
	}

	const bytes = new Uint8Array(
		await Bun.file(target).slice(0, Math.min(info.size, FILE_VIEW_TEXT_MAX_BYTES)).arrayBuffer(),
	);
	if (bytes.subarray(0, BINARY_PROBE_BYTES).includes(0)) {
		throw new ORPCError("UNPROCESSABLE_CONTENT", {
			message: "Arquivo binário não pode ser exibido no app",
		});
	}

	return {
		kind: "text",
		name,
		dir,
		path: target,
		size: info.size,
		truncated: info.size > FILE_VIEW_TEXT_MAX_BYTES,
		content: new TextDecoder().decode(bytes),
	};
}

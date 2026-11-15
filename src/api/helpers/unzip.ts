import { inflateRawSync } from "node:zlib";

export type UnzippedEntry = {
	path: string;
	data: Uint8Array;
	mode?: number;
};

const ZIP_ENTRY_LIMIT = 2000;
const ZIP_BYTES_LIMIT = 64 * 1024 * 1024;

function normalizeEntryPath(raw: string) {
	const path = raw.replaceAll("\\", "/").replace(/^\/+/, "");
	const segments = path.split("/").filter(Boolean);
	if (segments.some((segment) => segment === ".." || segment === "." || segment.includes("\0"))) {
		throw new Error(`Entrada inválida no zip: ${raw}`);
	}

	return segments.join("/");
}

export function unzipEntries(bytes: Uint8Array): UnzippedEntry[] {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let eocd = -1;
	for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65_557); offset--) {
		if (view.getUint32(offset, true) === 0x06054b50) {
			eocd = offset;
			break;
		}
	}
	if (eocd === -1) {
		throw new Error("O arquivo não é um zip válido");
	}

	const count = view.getUint16(eocd + 10, true);
	if (count > ZIP_ENTRY_LIMIT) {
		throw new Error(`O zip tem mais de ${ZIP_ENTRY_LIMIT} entradas`);
	}

	const decoder = new TextDecoder();
	const entries: UnzippedEntry[] = [];
	let total = 0;
	let pointer = view.getUint32(eocd + 16, true);

	for (let index = 0; index < count; index++) {
		if (view.getUint32(pointer, true) !== 0x02014b50) {
			throw new Error("Diretório central do zip corrompido");
		}
		const method = view.getUint16(pointer + 10, true);
		const compressedSize = view.getUint32(pointer + 20, true);
		const size = view.getUint32(pointer + 24, true);
		const nameLength = view.getUint16(pointer + 28, true);
		const extraLength = view.getUint16(pointer + 30, true);
		const commentLength = view.getUint16(pointer + 32, true);
		const externalAttributes = view.getUint32(pointer + 38, true);
		const localOffset = view.getUint32(pointer + 42, true);
		const rawName = decoder.decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength));
		pointer += 46 + nameLength + extraLength + commentLength;

		const unixType = (externalAttributes >>> 16) & 0o170000;
		if (rawName.endsWith("/") || unixType === 0o040000 || unixType === 0o120000) {
			continue;
		}

		total += size;
		if (total > ZIP_BYTES_LIMIT) {
			throw new Error("O zip descompactado passa de 64 MiB");
		}

		if (view.getUint32(localOffset, true) !== 0x04034b50) {
			throw new Error("Entrada do zip corrompida");
		}
		const localNameLength = view.getUint16(localOffset + 26, true);
		const localExtraLength = view.getUint16(localOffset + 28, true);
		const start = localOffset + 30 + localNameLength + localExtraLength;
		const compressed = bytes.subarray(start, start + compressedSize);

		let data: Uint8Array;
		if (method === 0) {
			data = compressed;
		} else if (method === 8) {
			data = new Uint8Array(inflateRawSync(compressed));
		} else {
			throw new Error(`Compressão não suportada no zip (método ${method})`);
		}
		if (data.length !== size) {
			throw new Error(`Tamanho inesperado em ${rawName}`);
		}

		const path = normalizeEntryPath(rawName);
		if (path) {
			const mode = (externalAttributes >>> 16) & 0o777;
			entries.push(mode ? { path, data, mode } : { path, data });
		}
	}

	return entries;
}

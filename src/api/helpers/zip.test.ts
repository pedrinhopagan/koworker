import { afterAll, expect, test } from "bun:test";
import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { zipDirectory } from "./zip";

const src = join(tmpdir(), `kw-zip-test-${process.pid}`);

afterAll(() => rm(src, { recursive: true, force: true }));

// STORED (método 0): o conteúdo de cada arquivo é verbatim no zip, então lê-lo de volta pelos local
// file headers prova o round-trip sem precisar de uma lib de descompressão.
function readStoredZip(bytes: Uint8Array): Map<string, string> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const decoder = new TextDecoder();
	const entries = new Map<string, string>();
	let pos = 0;

	while (pos + 4 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
		const compSize = view.getUint32(pos + 18, true);
		const nameLen = view.getUint16(pos + 26, true);
		const extraLen = view.getUint16(pos + 28, true);
		const name = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
		const dataStart = pos + 30 + nameLen + extraLen;
		entries.set(name, decoder.decode(bytes.subarray(dataStart, dataStart + compSize)));
		pos = dataStart + compSize;
	}

	return entries;
}

function readStoredZipBytes(bytes: Uint8Array): Map<string, Uint8Array> {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const decoder = new TextDecoder();
	const entries = new Map<string, Uint8Array>();
	let pos = 0;

	while (pos + 4 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
		const size = view.getUint32(pos + 18, true);
		const nameLength = view.getUint16(pos + 26, true);
		const extraLength = view.getUint16(pos + 28, true);
		const name = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLength));
		const dataStart = pos + 30 + nameLength + extraLength;
		entries.set(name, bytes.slice(dataStart, dataStart + size));
		pos = dataStart + size;
	}

	return entries;
}

test("zipDirectory leva a pasta-raiz como prefixo e preserva arquivos aninhados", async () => {
	await rm(src, { recursive: true, force: true });
	await mkdir(join(src, "sub"), { recursive: true });
	await writeFile(join(src, "index.md"), "# oi");
	await writeFile(join(src, "sub", "note.md"), "aninhado");

	const base = basename(src);
	const entries = readStoredZip(await zipDirectory(src));

	expect(entries.get(`${base}/index.md`)).toBe("# oi");
	expect(entries.get(`${base}/sub/note.md`)).toBe("aninhado");
});

test("zipDirectory cria ZIP vazio válido", async () => {
	await rm(src, { recursive: true, force: true });
	await mkdir(src, { recursive: true });

	const zip = await zipDirectory(src);

	expect(zip.length).toBe(22);
	expect(new DataView(zip.buffer).getUint32(0, true)).toBe(0x06054b50);
});

test("zipDirectory preserva nomes com espaço, Unicode e bytes binários e omite symlink", async () => {
	await rm(src, { recursive: true, force: true });
	await mkdir(src, { recursive: true });
	await writeFile(join(src, "guia ç com espaço.md"), "olá");
	await writeFile(join(src, "asset.bin"), new Uint8Array([0, 1, 128, 255]));
	await symlink(join(src, "asset.bin"), join(src, "atalho.bin"));

	const entries = readStoredZipBytes(await zipDirectory(src));
	const base = basename(src);

	expect(new TextDecoder().decode(entries.get(`${base}/guia ç com espaço.md`))).toBe("olá");
	expect(entries.get(`${base}/asset.bin`)).toEqual(new Uint8Array([0, 1, 128, 255]));
	expect(entries.has(`${base}/atalho.bin`)).toBe(false);
});

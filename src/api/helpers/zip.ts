import { readFile, readdir } from "node:fs/promises";
import { basename, posix } from "node:path";

// Escritor de ZIP sem dependência: compressão STORED (método 0). O ambiente não tem lib de zip nem
// o binário `zip`, e os conteúdos compartilhados são pastas de tarefas (.md pequenos), então guardar
// sem comprimir é suficiente e mantém o formato trivialmente correto. Espelha o build_zip do Rust:
// o zip leva a própria pasta como raiz, então extrair recria a pasta inteira.

const CRC_TABLE = (() => {
	const table = new Uint32Array(256);
	for (let n = 0; n < 256; n++) {
		let c = n;
		for (let k = 0; k < 8; k++) {
			c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
		}
		table[n] = c;
	}
	return table;
})();

// Retorna o padrão de 32 bits do CRC; o valor é escrito com setUint32, que já faz ToUint32.
function crc32(bytes: Uint8Array): number {
	let crc = 0xffffffff;
	for (let i = 0; i < bytes.length; i++) {
		crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff]! ^ (crc >>> 8);
	}
	return crc ^ 0xffffffff;
}

type ZipEntry = { name: string; data: Uint8Array; isDir: boolean };

// Varre a pasta em profundidade, sem seguir symlinks (não descidos nem confundidos com arquivo). O
// nome de cada entrada é relativo com a pasta-raiz como prefixo; diretórios terminam em `/`.
async function collectEntries(src: string): Promise<ZipEntry[]> {
	const base = basename(src) || "compartilhar";
	const entries: ZipEntry[] = [];

	async function walk(dir: string, relPrefix: string) {
		const dirents = await readdir(dir, { withFileTypes: true });

		for (const dirent of dirents.sort((a, b) => a.name.localeCompare(b.name))) {
			const rel = posix.join(relPrefix, dirent.name);
			const abs = `${dir}/${dirent.name}`;

			if (dirent.isDirectory()) {
				entries.push({ name: `${rel}/`, data: new Uint8Array(0), isDir: true });
				await walk(abs, rel);
			} else if (dirent.isFile()) {
				entries.push({ name: rel, data: await readFile(abs), isDir: false });
			}
		}
	}

	await walk(src, base);
	return entries;
}

// Local file header (ZIP APPNOTE 4.3.7): sig, versão, flags, método, hora, data, crc, tamanhos,
// comprimento do nome/extra, e então o nome. Método 0 grava os dados verbatim logo após.
function localHeader(nameBytes: Uint8Array, crc: number, size: number): Uint8Array {
	const buf = new Uint8Array(30 + nameBytes.length);
	const view = new DataView(buf.buffer);
	view.setUint32(0, 0x04034b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(8, 0, true);
	view.setUint16(12, 0x0021, true);
	view.setUint32(14, crc, true);
	view.setUint32(18, size, true);
	view.setUint32(22, size, true);
	view.setUint16(26, nameBytes.length, true);
	buf.set(nameBytes, 30);
	return buf;
}

// Central directory header (4.3.12): os mesmos campos do local mais atributos e o offset do local
// header. O bit 0x10 dos atributos externos marca diretório.
function centralHeader(
	nameBytes: Uint8Array,
	crc: number,
	size: number,
	offset: number,
	isDir: boolean,
): Uint8Array {
	const buf = new Uint8Array(46 + nameBytes.length);
	const view = new DataView(buf.buffer);
	view.setUint32(0, 0x02014b50, true);
	view.setUint16(4, 20, true);
	view.setUint16(6, 20, true);
	view.setUint16(12, 0x0021, true);
	view.setUint32(16, crc, true);
	view.setUint32(20, size, true);
	view.setUint32(24, size, true);
	view.setUint16(28, nameBytes.length, true);
	view.setUint32(38, isDir ? 0x10 : 0, true);
	view.setUint32(42, offset, true);
	buf.set(nameBytes, 46);
	return buf;
}

export async function zipDirectory(src: string): Promise<Uint8Array> {
	const entries = await collectEntries(src);
	const encoder = new TextEncoder();
	const local: Uint8Array[] = [];
	const central: Uint8Array[] = [];
	let offset = 0;

	for (const entry of entries) {
		const nameBytes = encoder.encode(entry.name);
		const crc = crc32(entry.data);
		const size = entry.data.length;
		const header = localHeader(nameBytes, crc, size);

		local.push(header, entry.data);
		central.push(centralHeader(nameBytes, crc, size, offset, entry.isDir));
		offset += header.length + entry.data.length;
	}

	const centralSize = central.reduce((sum, cd) => sum + cd.length, 0);

	const eocd = new Uint8Array(22);
	const eocdView = new DataView(eocd.buffer);
	eocdView.setUint32(0, 0x06054b50, true);
	eocdView.setUint16(8, entries.length, true);
	eocdView.setUint16(10, entries.length, true);
	eocdView.setUint32(12, centralSize, true);
	eocdView.setUint32(16, offset, true);

	const out = new Uint8Array(offset + centralSize + eocd.length);
	let pos = 0;
	for (const chunk of [...local, ...central, eocd]) {
		out.set(chunk, pos);
		pos += chunk.length;
	}

	return out;
}

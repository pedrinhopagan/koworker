// O scrollback cru é um ring buffer: quando o shell passa do teto, o replay no attach
// precisa dos últimos bytes em ordem, não dos primeiros.
export class ScrollbackRing {
	private readonly bytes: Uint8Array;
	private head = 0;
	private total = 0;

	constructor(capacityBytes: number) {
		this.bytes = new Uint8Array(capacityBytes);
	}

	append(chunk: Buffer): void {
		const size = chunk.length;
		if (size === 0) {
			return;
		}

		const data = size > this.bytes.length ? chunk.subarray(size - this.bytes.length) : chunk;
		const first = Math.min(data.length, this.bytes.length - this.head);
		this.bytes.set(data.subarray(0, first), this.head);
		if (first < data.length) {
			this.bytes.set(data.subarray(first), 0);
		}

		this.head = (this.head + data.length) % this.bytes.length;
		this.total += size;
	}

	readBase64(): string {
		if (this.total === 0) {
			return "";
		}

		const length = Math.min(this.total, this.bytes.length);
		const start = this.total <= this.bytes.length ? 0 : this.head;
		const end = start + length;
		if (end <= this.bytes.length) {
			return Buffer.from(this.bytes.slice(start, end)).toString("base64");
		}

		// A janela cruza o fim do array: a parte que voltou pro começo vem primeiro.
		const merged = Buffer.concat([
			Buffer.from(this.bytes.slice(start)),
			Buffer.from(this.bytes.slice(0, end - this.bytes.length)),
		]);
		return merged.toString("base64");
	}
}

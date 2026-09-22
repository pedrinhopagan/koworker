import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { filePreviewUrl } from "@/lib/file-preview";
import { serveFilePreview } from "./file-preview";

let root: string;
let outside: string;

beforeAll(async () => {
	root = await mkdtemp(join(tmpdir(), "kowork-preview-"));
	outside = await mkdtemp(join(tmpdir(), "kowork-preview-outside-"));
	await writeFile(
		join(root, "página #1.html"),
		'<link rel="stylesheet" href="style.css"><script>document.body.dataset.ready = "yes"</script>',
	);
	await writeFile(join(root, "documento.pdf"), "%PDF-1.7\n0123456789");
	await writeFile(join(root, "style.css"), "body { color: red; }");
	await writeFile(join(outside, "secret.html"), "segredo");
	await symlink(join(outside, "secret.html"), join(root, "escape.html"));
});

afterAll(async () => {
	await rm(root, { recursive: true, force: true });
	await rm(outside, { recursive: true, force: true });
});

function request(name: string, init?: RequestInit) {
	return new Request(`http://localhost${filePreviewUrl(join(root, name), "test-token")}`, init);
}

describe("serveFilePreview", () => {
	test("revalida o cache sem retransmitir recursos que não mudaram", async () => {
		const first = await serveFilePreview(request("style.css"), [root]);
		const cached = await serveFilePreview(
			request("style.css", { headers: { "if-none-match": first.headers.get("etag")! } }),
			[root],
		);
		expect(cached.status).toBe(304);
		expect(await cached.text()).toBe("");
		expect(cached.headers.has("content-length")).toBe(false);
	});
	test("HTML mantém scripts e caminhos relativos em uma origem isolada", async () => {
		const input = request("página #1.html");
		const response = await serveFilePreview(input, [root]);
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
		expect(response.headers.get("content-security-policy")).toContain("sandbox allow-scripts");
		expect(response.headers.get("content-security-policy")).not.toContain("allow-same-origin");
		expect(await response.text()).toContain('href="style.css"');
		const stylesheet = await serveFilePreview(new Request(new URL("style.css", input.url)), [root]);
		expect(stylesheet.status).toBe(200);
		expect(await stylesheet.text()).toBe("body { color: red; }");
	});

	test("PDF aceita leitura parcial e HEAD sem carregar o documento inteiro", async () => {
		const response = await serveFilePreview(
			request("documento.pdf", { headers: { range: "bytes=0-7" } }),
			[root],
		);
		expect(response.status).toBe(206);
		expect(response.headers.get("content-type")).toBe("application/pdf");
		expect(response.headers.get("content-security-policy")).not.toContain("sandbox");
		expect(response.headers.get("content-range")).toBe("bytes 0-7/19");
		expect(response.headers.get("content-length")).toBe("8");
		expect(await response.text()).toBe("%PDF-1.7");
		const head = await serveFilePreview(request("documento.pdf", { method: "HEAD" }), [root]);
		expect(head.headers.get("content-length")).toBe("19");
		expect(await head.text()).toBe("");
	});

	test("ranges abertos, sufixos e inválidos têm respostas corretas", async () => {
		for (const range of ["bytes=14-", "bytes=-5", "bytes=14-100"]) {
			const response = await serveFilePreview(request("documento.pdf", { headers: { range } }), [
				root,
			]);
			expect(response.status).toBe(206);
			expect(await response.text()).toBe("56789");
		}
		for (const range of [
			"bytes=",
			"bytes=-",
			"bytes=-0",
			"bytes=20-",
			"bytes=8-2",
			"bytes=0-1,4-5",
		]) {
			const response = await serveFilePreview(request("documento.pdf", { headers: { range } }), [
				root,
			]);
			expect(response.status).toBe(416);
			expect(response.headers.get("content-range")).toBe("bytes */19");
		}
	});

	test("recusa caminhos fora dos projetos, symlinks, diretórios e escritas", async () => {
		for (const path of [join(outside, "secret.html"), join(root, "escape.html")]) {
			const response = await serveFilePreview(
				new Request(`http://localhost${filePreviewUrl(path, "test-token")}`),
				[root],
			);
			expect(response.status).toBe(403);
		}
		expect((await serveFilePreview(request("ausente.html"), [root])).status).toBe(404);
		expect((await serveFilePreview(request(""), [root])).status).toBe(404);
		expect(
			(await serveFilePreview(request("documento.pdf", { method: "POST" }), [root])).status,
		).toBe(405);
	});
});

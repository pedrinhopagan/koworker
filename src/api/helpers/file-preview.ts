import { basename, extname } from "node:path";

import { ORPCError } from "@orpc/server";

import { PREVIEW_SCROLL_MESSAGE } from "@/lib/file-preview";
import { resolveViewableFile } from "./file-view";

// O documento roda numa origem isolada, então a página não enxerga a rolagem dele. O HTML avisa o
// app só a direção e a posição de quem rolou, para o celular recolher o cabeçalho e dar a tela ao
// conteúdo. `capture` pega também quem rola num contêiner interno, não só a janela.
const PREVIEW_SCROLL_BRIDGE = `<script>(()=>{const last=new WeakMap();addEventListener("scroll",(event)=>{const target=event.target===document?document.scrollingElement:event.target;if(!target)return;const top=target.scrollTop;const delta=top-(last.get(target)??top);last.set(target,top);if(delta)parent.postMessage({type:"${PREVIEW_SCROLL_MESSAGE}",delta,top},"*")},{capture:true,passive:true})})()</script>`;

export async function serveFilePreview(request: Request, roots: string[]) {
	if (request.method !== "GET" && request.method !== "HEAD") {
		return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
	}

	try {
		const path = decodeURIComponent(
			new URL(request.url).pathname
				.slice("/api/file-preview/".length)
				.split("/")
				.slice(1)
				.join("/"),
		);
		const { target, info } = await resolveViewableFile(path, roots);
		const file = Bun.file(target);
		const extension = extname(target).toLowerCase();
		const headers = new Headers({
			"Content-Type": file.type,
			"Content-Length": String(info.size),
			"Cache-Control": "private, no-cache",
			ETag: `W/"${info.size}-${info.mtimeMs}"`,
			"X-Content-Type-Options": "nosniff",
			"Referrer-Policy": "no-referrer",
			"Accept-Ranges": "bytes",
			"Access-Control-Allow-Origin": "*",
			"Content-Security-Policy": "frame-ancestors 'self'; sandbox allow-scripts allow-downloads",
		});
		if (extension === ".pdf") {
			headers.set("Content-Type", "application/pdf");
			headers.set(
				"Content-Disposition",
				`inline; filename*=UTF-8''${encodeURIComponent(basename(target))}`,
			);
			headers.set("Content-Security-Policy", "frame-ancestors 'self'");
		} else if (extension === ".html" || extension === ".htm") {
			headers.set("Content-Type", "text/html; charset=utf-8");
		}

		if (request.headers.get("if-none-match") === headers.get("etag")) {
			headers.delete("Content-Length");
			return new Response(null, { status: 304, headers });
		}

		if (headers.get("Content-Type") === "text/html; charset=utf-8") {
			const html = request.method === "HEAD" ? null : (await file.text()) + PREVIEW_SCROLL_BRIDGE;
			headers.delete("Content-Length");
			headers.delete("Accept-Ranges");
			return new Response(html, { headers });
		}

		const range = request.headers.has("if-range") ? null : request.headers.get("range");
		if (range) {
			const match = /^bytes=(\d*)-(\d*)$/.exec(range);
			const start = match?.[1] ? Number(match[1]) : Math.max(0, info.size - Number(match?.[2]));
			const end =
				match?.[1] && match[2] ? Math.min(Number(match[2]), info.size - 1) : info.size - 1;
			if (
				!match ||
				(!match[1] && !match[2]) ||
				!Number.isSafeInteger(start) ||
				!Number.isSafeInteger(end) ||
				start > end ||
				start >= info.size
			) {
				headers.set("Content-Range", `bytes */${info.size}`);
				headers.set("Content-Length", "0");
				return new Response(null, { status: 416, headers });
			}
			headers.set("Content-Range", `bytes ${start}-${end}/${info.size}`);
			headers.set("Content-Length", String(end - start + 1));
			return new Response(request.method === "HEAD" ? null : file.slice(start, end + 1), {
				status: 206,
				headers,
			});
		}
		return new Response(request.method === "HEAD" ? null : file, { headers });
	} catch (error) {
		if (error instanceof ORPCError) {
			return new Response(error.message, { status: error.status });
		}
		if (error instanceof URIError) {
			return new Response("Caminho inválido", { status: 400 });
		}
		throw error;
	}
}

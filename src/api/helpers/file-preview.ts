import { basename, extname } from "node:path";

import { ORPCError } from "@orpc/server";

import { resolveViewableFile } from "./file-view";

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

import { realpath } from "node:fs/promises";
import { join } from "node:path";

import { decodeHtmlText, type TaskArtifactMeta } from "./koworker-assets";
import { isPathInside } from "./path-containment";

const ignoredWords = new Set(
	"a o as os um uma uns umas de da do das dos em no na nos nas e ou para por com que eu quero preciso buscar encontrar sobre the of and to in".split(
		" ",
	),
);
const cache = new Map<
	string,
	{ version: string; document: Promise<SearchDocument>; characters: number }
>();
const cacheCharacterLimit = 16_000_000;
const textBoundaries = new Set(
	"address article aside blockquote br dd div dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hr li main nav ol p pre section table tbody td th thead title tr ul".split(
		" ",
	),
);
const queue: (() => void)[] = [];
let cachedCharacters = 0;
let activeReads = 0;

type SearchDocument = ReturnType<typeof createDocument>;

function normalize(value: string) {
	return value.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase();
}

function words(value: string) {
	return normalize(value).match(/[\p{L}\p{N}]+/gu) ?? [];
}

function createDocument(text: string) {
	return { text, normalized: normalize(text), words: new Set(words(text)) };
}

function evict(path: string) {
	const entry = cache.get(path);
	cachedCharacters -= entry?.characters ?? 0;
	cache.delete(path);
}

async function readDocument(path: string) {
	if (activeReads >= 4) {
		await new Promise<void>((resolve) => {
			queue.push(resolve);
		});
	} else {
		activeReads++;
	}

	try {
		const chunks: string[] = [];
		const cleaned = new HTMLRewriter()
			.on("script, style, template, noscript", {
				element(element) {
					element.remove();
				},
			})
			.transform(new Response(Bun.file(path)));
		const extracted = new HTMLRewriter()
			.on("*", {
				element(element) {
					if (textBoundaries.has(element.tagName)) {
						chunks.push(" ");
						if (element.canHaveContent) {
							element.onEndTag(() => {
								chunks.push(" ");
							});
						}
					}
					if (element.tagName === "meta") {
						const name = element.getAttribute("name");
						if (name === "description" || name === "koworker:heading") {
							chunks.push(` ${element.getAttribute("content") ?? ""} `);
						}
					}
				},
			})
			.onDocument({
				text: (chunk) => {
					chunks.push(chunk.text);
				},
			})
			.transform(cleaned);
		if (!extracted.body) {
			throw new Error("Não foi possível ler o conteúdo do HTML");
		}
		const reader = extracted.body.getReader();
		while (!(await reader.read()).done) {}

		return createDocument(decodeHtmlText(chunks.join("")));
	} finally {
		const next = queue.shift();
		if (next) {
			next();
		} else {
			activeReads--;
		}
	}
}

async function cachedDocument(path: string, artifact: TaskArtifactMeta) {
	const version = `${artifact.mtime}:${artifact.size}`;
	const cached = cache.get(path);
	if (cached?.version === version) {
		cache.delete(path);
		cache.set(path, cached);
		return await cached.document;
	}

	evict(path);
	const document = readDocument(path);
	const entry = { version, document, characters: 0 };
	cache.set(path, entry);

	try {
		const result = await document;
		if (cache.get(path) === entry) {
			entry.characters =
				result.text.length * 2 +
				[...result.words].reduce((total, word) => total + word.length + 24, 0);
			cachedCharacters += entry.characters;
			while (cachedCharacters > cacheCharacterLimit) {
				const oldest = cache.keys().next().value;
				if (!oldest) {
					break;
				}
				evict(oldest);
			}
		}
		return result;
	} catch (error) {
		if (cache.get(path) === entry) {
			evict(path);
		}
		if (error instanceof Error && "code" in error && error.code === "ENOENT") {
			return createDocument("");
		}
		throw error;
	}
}

function oneEditApart(left: string, right: string) {
	if (Math.abs(left.length - right.length) > 1) {
		return false;
	}
	let a = 0;
	let b = 0;
	let edits = 0;
	while (a < left.length && b < right.length) {
		if (left[a] === right[b]) {
			a++;
			b++;
			continue;
		}
		if (++edits > 1) {
			return false;
		}
		if (left.length === right.length && left[a] === right[b + 1] && left[a + 1] === right[b]) {
			a += 2;
			b += 2;
			continue;
		}
		if (left.length <= right.length) {
			b++;
		}
		if (left.length >= right.length) {
			a++;
		}
	}
	return edits + Number(a < left.length || b < right.length) <= 1;
}

function matchWord(term: string, vocabulary: Set<string>) {
	if (vocabulary.has(term)) {
		return { word: term, score: 1 };
	}
	if (term.length >= 3) {
		for (const word of vocabulary) {
			if (word.startsWith(term)) {
				return { word, score: 0.7 };
			}
		}
	}
	if (term.length >= 5) {
		for (const word of vocabulary) {
			if (oneEditApart(term, word)) {
				return { word, score: 0.4 };
			}
		}
	}
	return null;
}

export function prepareShowcaseSearch(query: string) {
	const tokens = [...new Set(words(query))];
	const meaningful = tokens.filter((token) => !ignoredWords.has(token));
	return { terms: meaningful.length > 0 ? meaningful : tokens, phrase: normalize(query.trim()) };
}

export async function searchShowcaseArtifact(params: {
	projectRoute: string;
	folderPath: string;
	taskTitle: string;
	artifact: TaskArtifactMeta;
	search: ReturnType<typeof prepareShowcaseSearch>;
}) {
	const { artifact, search } = params;
	if (search.terms.length === 0) {
		return null;
	}
	const title = createDocument(`${artifact.name} ${artifact.metadata?.title ?? ""}`);
	const context = createDocument(
		`${params.taskTitle} ${artifact.metadata?.subtitle ?? ""} ${(artifact.metadata?.headings ?? []).join(" ")}`,
	);
	const root = await realpath(params.projectRoute).catch(() => null);
	const path = await realpath(join(params.projectRoute, params.folderPath, artifact.name)).catch(
		() => null,
	);
	const content =
		artifact.mime === "text/html" && root && path && isPathInside(root, path)
			? await cachedDocument(path, artifact)
			: createDocument("");
	const fields = [
		{ document: title, weight: 8 },
		{ document: context, weight: 4 },
		{ document: content, weight: 1 },
	];
	let score = 0;
	const matchedWords = new Set<string>();
	for (const term of search.terms) {
		const matches = fields.flatMap(({ document, weight }) => {
			const match = matchWord(term, document.words);
			if (!match) {
				return [];
			}
			matchedWords.add(match.word);
			return [match.score * weight];
		});
		if (matches.length === 0) {
			return null;
		}
		score += Math.max(...matches);
	}
	for (const { document, weight } of fields) {
		if (document.normalized.includes(search.phrase)) {
			score += weight * 2;
		}
	}
	const positions = [...matchedWords]
		.map((word) => content.normalized.indexOf(word))
		.filter((position) => position >= 0);
	const position = Math.min(...positions);
	const start = Math.max(0, position - 90);
	const snippet =
		positions.length > 0
			? `${start > 0 ? "…" : ""}${content.text.slice(start, start + 240)}${start + 240 < content.text.length ? "…" : ""}`
			: context.text.slice(0, 240);

	return { score, snippet, words: [...matchedWords] };
}

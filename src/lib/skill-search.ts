import type { TaskSkill } from "@/types/skills";

export type SkillMatchKind = "name" | "description" | "content";

export type TextRange = [start: number, end: number];

type SearchFields = {
	title: string;
	slug: string;
	description: string;
	keywords?: string[];
	content?: string;
};

type PreparedName = {
	folded: string;
	compact: string;
	words: string[];
	initials: string;
};

type PreparedText = {
	text: string;
	folded: string;
};

export type SearchDoc = {
	names: PreparedName[];
	description: PreparedText;
	content: PreparedText | null;
};

export type SearchQuery = {
	terms: string[];
	compact: string;
};

export type DocScore = {
	rank: number;
	total: number;
	kind: SkillMatchKind;
};

export type SkillSearchHit = DocScore & {
	skill: TaskSkill;
	labelRanges: TextRange[];
	slugRanges: TextRange[];
	descriptionRanges: TextRange[];
	snippet: { text: string; ranges: TextRange[] } | null;
};

const TIER = {
	exact: 0,
	prefix: 1,
	wordPrefix: 2,
	contains: 3,
	initials: 4,
	typo: 5,
	descriptionWord: 6,
	description: 7,
	content: 8,
} as const;

const SNIPPET_BEFORE = 36;
const SNIPPET_LENGTH = 140;

const foldedChars = new Map<string, string>();

function foldChar(char: string) {
	let folded = foldedChars.get(char);
	if (folded === undefined) {
		const base = char.normalize("NFD")[0] ?? char;
		folded = base.toLowerCase()[0] ?? base;
		foldedChars.set(char, folded);
	}

	return folded;
}

export function normalizeSearchText(value: string) {
	return value.replaceAll(/[\u0080-￿]/g, foldChar).toLowerCase();
}

function isWordChar(code: number) {
	return (code >= 97 && code <= 122) || (code >= 48 && code <= 57);
}

function wordStartIndex(text: string, term: string, from = 0) {
	let index = text.indexOf(term, from);
	while (index !== -1) {
		if (index === 0 || !isWordChar(text.codePointAt(index - 1) ?? 0)) {
			return index;
		}
		index = text.indexOf(term, index + 1);
	}

	return -1;
}

function withinOneEdit(left: string, right: string) {
	if (left === right) return true;
	if (Math.abs(left.length - right.length) > 1) return false;

	let index = 0;
	while (index < left.length && left[index] === right[index]) index += 1;

	if (left.length === right.length) {
		if (left.slice(index + 1) === right.slice(index + 1)) return true;
		return (
			left[index] === right[index + 1] &&
			left[index + 1] === right[index] &&
			left.slice(index + 2) === right.slice(index + 2)
		);
	}

	const [longer, shorter] = left.length > right.length ? [left, right] : [right, left];
	return longer.slice(index + 1) === shorter.slice(index);
}

function prepareName(value: string): PreparedName {
	const folded = normalizeSearchText(value);
	const words = folded.split(/[^a-z0-9]+/).filter(Boolean);

	return {
		folded,
		compact: words.join(""),
		words,
		initials: words.map((word) => word[0]).join(""),
	};
}

function prepareText(text: string): PreparedText {
	return { text, folded: normalizeSearchText(text) };
}

export function prepareSearchDoc(fields: SearchFields): SearchDoc {
	const names = [fields.title, fields.slug, ...(fields.keywords ?? [])]
		.filter(Boolean)
		.map(prepareName);

	return {
		names,
		description: prepareText(fields.description),
		content: fields.content ? prepareText(fields.content) : null,
	};
}

export function parseSearchQuery(raw: string): SearchQuery {
	const words = normalizeSearchText(raw).split(/\s+/).filter(Boolean);
	const terms = [...new Set(words)].toSorted((left, right) => right.length - left.length);

	return { terms, compact: words.join("").replaceAll(/[^a-z0-9]/g, "") };
}

function nameTier(name: PreparedName, term: string) {
	if (name.folded === term) return TIER.exact;
	if (name.folded.startsWith(term)) return TIER.prefix;
	if (wordStartIndex(name.folded, term) !== -1) return TIER.wordPrefix;
	if (name.folded.includes(term)) return TIER.contains;
	if (term.length >= 2 && name.words.length > 1 && name.initials.startsWith(term)) {
		return TIER.initials;
	}
	if (
		term.length >= 4 &&
		name.words.some(
			(word) =>
				withinOneEdit(word, term) ||
				(word.length > term.length && withinOneEdit(word.slice(0, term.length), term)),
		)
	) {
		return TIER.typo;
	}

	return null;
}

function phraseTier(doc: SearchDoc, query: SearchQuery) {
	if (query.compact.length < 2) return null;

	let best: number | null = null;
	for (const name of doc.names) {
		const tier =
			name.compact === query.compact
				? TIER.exact
				: name.compact.startsWith(query.compact)
					? TIER.prefix
					: null;
		if (tier !== null && (best === null || tier < best)) best = tier;
	}

	return best;
}

function termTier(doc: SearchDoc, term: string) {
	let best: number | null = null;
	for (const name of doc.names) {
		const tier = nameTier(name, term);
		if (tier !== null && (best === null || tier < best)) best = tier;
		if (best === TIER.exact) return best;
	}
	if (best !== null) return best;

	if (wordStartIndex(doc.description.folded, term) !== -1) return TIER.descriptionWord;
	if (doc.description.folded.includes(term)) return TIER.description;
	if (term.length >= 2 && doc.content?.folded.includes(term)) return TIER.content;

	return null;
}

export function matchKind(rank: number): SkillMatchKind {
	if (rank <= TIER.typo) return "name";
	if (rank <= TIER.description) return "description";

	return "content";
}

export function scoreSearchDoc(doc: SearchDoc, query: SearchQuery): DocScore | null {
	if (query.terms.length === 0) {
		return { rank: 0, total: 0, kind: "name" };
	}

	let rank = 0;
	let total = 0;
	for (const term of query.terms) {
		const tier = termTier(doc, term);
		if (tier === null) return null;
		rank = Math.max(rank, tier);
		total += tier;
	}

	const phrase = phraseTier(doc, query);
	if (phrase !== null && phrase < rank) {
		rank = phrase;
		total = phrase;
	}

	return { rank, total, kind: matchKind(rank) };
}

export function matchRank(fields: SearchFields, rawQuery: string) {
	return scoreSearchDoc(prepareSearchDoc(fields), parseSearchQuery(rawQuery))?.rank ?? null;
}

function mergeRanges(ranges: TextRange[]) {
	const sorted = ranges.toSorted((left, right) => left[0] - right[0]);
	const merged: TextRange[] = [];
	for (const range of sorted) {
		const last = merged.at(-1);
		if (last && range[0] <= last[1]) {
			last[1] = Math.max(last[1], range[1]);
		} else {
			merged.push([range[0], range[1]]);
		}
	}

	return merged;
}

function findRanges(folded: string, terms: string[], limit = 24) {
	const ranges: TextRange[] = [];
	for (const term of terms) {
		let index = folded.indexOf(term);
		while (index !== -1 && ranges.length < limit) {
			ranges.push([index, index + term.length]);
			index = folded.indexOf(term, index + term.length);
		}
	}

	return mergeRanges(ranges);
}

export function highlightRanges(text: string, terms: string[]) {
	if (terms.length === 0 || !text) return [];

	return findRanges(normalizeSearchText(text), terms);
}

function buildSnippet(field: PreparedText, terms: string[]) {
	let anchor = -1;
	for (const term of terms) {
		const index = wordStartIndex(field.folded, term);
		const found = index === -1 ? field.folded.indexOf(term) : index;
		if (found !== -1 && (anchor === -1 || found < anchor)) anchor = found;
	}
	if (anchor === -1) return null;

	let start = Math.max(0, anchor - SNIPPET_BEFORE);
	if (start > 0) {
		const space = field.text.indexOf(" ", start);
		if (space !== -1 && space < anchor) start = space + 1;
	}
	let end = Math.min(field.text.length, start + SNIPPET_LENGTH);
	if (end < field.text.length) {
		const space = field.text.lastIndexOf(" ", end);
		if (space > anchor) end = space;
	}

	const prefix = start > 0 ? "…" : "";
	const suffix = end < field.text.length ? "…" : "";
	const body = field.text.slice(start, end).replaceAll(/\s/g, " ");
	const ranges = findRanges(field.folded.slice(start, end), terms).map(
		([from, to]): TextRange => [from + prefix.length, to + prefix.length],
	);

	return { text: `${prefix}${body}${suffix}`, ranges };
}

type IndexedSkill = { skill: TaskSkill; doc: SearchDoc; index: number };

export function createSkillSearch(skills: TaskSkill[]) {
	const indexed: IndexedSkill[] = skills.map((skill, index) => ({
		skill,
		index,
		doc: prepareSearchDoc({
			title: skill.label,
			slug: skill.slug,
			description: skill.description,
			content: skill.content,
		}),
	}));

	return (rawQuery: string): SkillSearchHit[] => {
		const query = parseSearchQuery(rawQuery);
		if (query.terms.length === 0) {
			return indexed.map(({ skill }) => ({
				skill,
				rank: 0,
				total: 0,
				kind: "name",
				labelRanges: [],
				slugRanges: [],
				descriptionRanges: [],
				snippet: null,
			}));
		}

		return indexed
			.flatMap((entry) => {
				const score = scoreSearchDoc(entry.doc, query);
				return score ? [{ ...entry, score }] : [];
			})
			.toSorted(
				(left, right) =>
					left.score.rank - right.score.rank ||
					left.score.total - right.score.total ||
					left.skill.label.length - right.skill.label.length ||
					left.index - right.index,
			)
			.map(({ skill, doc, score }) => ({
				skill,
				rank: score.rank,
				total: score.total,
				kind: score.kind,
				labelRanges: highlightRanges(skill.label, query.terms),
				slugRanges: highlightRanges(skill.slug, query.terms),
				descriptionRanges: findRanges(doc.description.folded, query.terms),
				snippet:
					score.kind === "content" && doc.content ? buildSnippet(doc.content, query.terms) : null,
			}));
	};
}

export function searchSkills(skills: TaskSkill[], query: string) {
	return createSkillSearch(skills)(query).map((hit) => hit.skill);
}

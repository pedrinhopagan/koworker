import { highlightTree } from "@lezer/highlight";
import { type ReactNode, useEffect, useMemo, useRef, useSyncExternalStore } from "react";

import {
	codeLanguageForFile,
	codeLanguageVersion,
	loadedCodeLanguage,
	markdownHighlightStyle,
	mountMarkdownHighlightStyle,
	subscribeCodeLanguages,
} from "@/lib/markdown-engine";
import { cn } from "@/lib/utils";

mountMarkdownHighlightStyle();

// Uma linha por elemento (numeração, destaque e rolagem até a linha citada), mantendo as classes de
// sintaxe: um token que atravessa linhas vira um span por linha.
export function highlightLines(code: string, language: string | null): ReactNode[][] {
	let current: ReactNode[] = [];
	const lines = [current];

	function push(text: string, classes?: string) {
		text.split("\n").forEach((part, index) => {
			if (index > 0) {
				current = [];
				lines.push(current);
			}
			if (part) {
				current.push(
					classes ? (
						<span key={current.length} className={classes}>
							{part}
						</span>
					) : (
						part
					),
				);
			}
		});
	}

	const support = language ? loadedCodeLanguage(language) : null;
	if (support) {
		const tree = support.language.parser.parse(code);
		let pos = 0;
		highlightTree(tree, markdownHighlightStyle, (from, to, classes) => {
			if (from > pos) {
				push(code.slice(pos, from));
			}
			push(code.slice(from, to), classes);
			pos = to;
		});
		if (pos < code.length) {
			push(code.slice(pos));
		}
	} else {
		push(code);
	}

	if (lines.length > 1 && code.endsWith("\n")) {
		lines.pop();
	}

	return lines;
}

export function CodeFileView({
	code,
	fileName,
	line,
	className,
}: {
	code: string;
	fileName: string;
	line?: number;
	className?: string;
}) {
	const version = useSyncExternalStore(
		subscribeCodeLanguages,
		codeLanguageVersion,
		codeLanguageVersion,
	);
	const language = codeLanguageForFile(fileName);
	const lines = useMemo(
		() => highlightLines(code, language),
		// `version` entra de propósito: a linguagem que acabou de carregar pede um novo destaque.
		// oxlint-disable-next-line exhaustive-deps
		[code, language, version],
	);
	const target = useRef<HTMLDivElement>(null);
	const gutter = `${String(lines.length).length + 1}ch`;

	useEffect(() => {
		target.current?.scrollIntoView({ block: "center" });
	}, [line, code]);

	return (
		<pre
			data-component="code-file-view"
			data-language={language ?? undefined}
			className={cn("m-0 min-w-0 overflow-x-auto font-mono text-[12px] leading-5", className)}
		>
			<code className="block min-w-max">
				{lines.map((nodes, index) => {
					const number = index + 1;
					const cited = number === line;

					return (
						<div
							key={number}
							ref={cited ? target : undefined}
							data-line={number}
							data-cited={cited || undefined}
							className={cn("flex", cited && "bg-primary/15")}
						>
							<span
								aria-hidden
								className="sticky left-0 shrink-0 select-none border-r border-border bg-background pr-2 text-right text-muted-foreground/60"
								style={{ minWidth: gutter }}
							>
								{number}
							</span>
							<span className="whitespace-pre px-3">{nodes}</span>
						</div>
					);
				})}
			</code>
		</pre>
	);
}

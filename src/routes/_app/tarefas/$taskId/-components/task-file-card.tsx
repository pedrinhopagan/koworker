import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import { formatBytes } from "@/lib/format-bytes";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

// Primeiro parágrafo de um `.md`, sem headings nem markup inline, pra servir de resumo no card. Pula
// linhas em branco e headings (`#`), junta as linhas do primeiro bloco de texto, desfaz o markup mais
// comum (negrito, código inline, links) e trunca. Retorna null quando o arquivo é só título/estrutura.
export function markdownSummary(content: string): string | null {
	const lines = content.split("\n");
	const paragraph: string[] = [];

	for (const line of lines) {
		const trimmed = line.trim();

		if (paragraph.length === 0 && (trimmed === "" || trimmed.startsWith("#"))) {
			continue;
		}
		if (paragraph.length > 0 && trimmed === "") {
			break;
		}
		paragraph.push(trimmed);
	}

	if (paragraph.length === 0) {
		return null;
	}

	const text = paragraph
		.join(" ")
		.replaceAll("**", "")
		.replaceAll("`", "")
		.replaceAll(/\[([^\]]+)\]\([^)]*\)/g, "$1")
		.trim();

	if (!text) {
		return null;
	}
	if (text.length <= 180) {
		return text;
	}
	return `${text.slice(0, 180).trimEnd()}…`;
}

// Textos dos headings de nível 2 e 3 de um `.md`, pra montar um mini-índice no card hero. Ignora o
// título de nível 1 (`# `), que costuma ser o nome do doc, pula o que está dentro de fences ``` de
// código e desfaz o markup inline (negrito, código, links). Limita a 8 pra não estourar o card.
export function markdownHeadings(content: string): string[] {
	const headings: string[] = [];
	let inFence = false;

	for (const line of content.split("\n")) {
		const trimmed = line.trim();

		if (trimmed.startsWith("```")) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}

		const match = trimmed.match(/^(#{2,3})\s+(.+)$/);
		if (!match) {
			continue;
		}

		const text = match[2]
			.replaceAll("**", "")
			.replaceAll("`", "")
			.replaceAll(/\[([^\]]+)\]\([^)]*\)/g, "$1")
			.trim();

		if (text) {
			headings.push(text);
		}
		if (headings.length >= 8) {
			break;
		}
	}

	return headings;
}

// Texto do primeiro heading de nível 1 (`# `) de um `.md` — normalmente o título do documento. Pula o
// que está dentro de fences ``` de código e desfaz o markup inline. Retorna null quando não há h1.
export function markdownTitle(content: string): string | null {
	let inFence = false;

	for (const line of content.split("\n")) {
		const trimmed = line.trim();

		if (trimmed.startsWith("```")) {
			inFence = !inFence;
			continue;
		}
		if (inFence) {
			continue;
		}

		const match = trimmed.match(/^#\s+(.+)$/);
		if (!match) {
			continue;
		}

		const text = match[1]
			.replaceAll("**", "")
			.replaceAll("`", "")
			.replaceAll(/\[([^\]]+)\]\([^)]*\)/g, "$1")
			.trim();

		if (text) {
			return text;
		}
	}

	return null;
}

type TaskFileCardProps = {
	icon: LucideIcon;
	name: string;
	// Título vindo do primeiro `# ` do arquivo, com o nome do arquivo como legenda discreta. Presente
	// só nos `.md` (os anexos passam sem title e mostram o próprio nome em destaque).
	title?: string | null;
	summary?: string | null;
	headings?: string[];
	size: number;
	timestamp: number;
	hero?: boolean;
	to?: "/tarefas/$taskId/$file";
	params?: { taskId: string; file: string };
	onClick?: () => void;
};

export function TaskFileCard({
	icon: Icon,
	name,
	title,
	summary,
	headings,
	size,
	timestamp,
	hero,
	to,
	params,
	onClick,
}: TaskFileCardProps) {
	const className = cn(
		"group flex w-full flex-col gap-2 border border-border text-left transition-colors hover:border-[var(--project-accent,var(--primary))] hover:bg-muted/30 rounded-none",
		hero ? "gap-3 p-5" : "p-3",
	);

	const showHeadings = hero && headings && headings.length > 0;

	const content = (
		<>
			<div className="flex items-center gap-3">
				<span
					className={cn(
						"flex shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground",
						hero ? "size-11" : "size-9",
					)}
				>
					<Icon size={hero ? 22 : 18} />
				</span>
				<div className="flex min-w-0 flex-1 flex-col">
					<span
						className={cn(
							"truncate font-medium group-hover:text-foreground",
							hero ? "text-base" : "text-sm",
						)}
					>
						{title ?? name}
					</span>
					{title ? <span className="truncate text-xs text-muted-foreground">{name}</span> : null}
				</div>
			</div>
			{summary ? (
				<p className={cn("text-sm text-muted-foreground", hero ? "line-clamp-3" : "line-clamp-2")}>
					{summary}
				</p>
			) : null}
			{showHeadings ? (
				<ul className="flex flex-col gap-1.5">
					{headings.map((heading) => (
						<li key={heading} className="flex items-start gap-2 text-sm text-muted-foreground">
							<span className="mt-1.5 size-1.5 shrink-0 bg-[var(--project-accent,var(--primary))]" />
							<span className="min-w-0 truncate">{heading}</span>
						</li>
					))}
				</ul>
			) : null}
			<span className="mt-auto text-xs text-muted-foreground">
				{formatBytes(size)} · {relativeTimeFrom(timestamp)}
			</span>
		</>
	);

	if (to && params) {
		return (
			<Link to={to} params={params} className={className}>
				{content}
			</Link>
		);
	}

	return (
		<button type="button" onClick={onClick} className={className}>
			{content}
		</button>
	);
}

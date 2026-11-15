import {
	Check,
	ChevronRight,
	FileDiff,
	Loader2,
	Terminal,
	TriangleAlert,
	Wrench,
} from "lucide-react";
import { useState } from "react";
import { MarkdownView } from "@/components/markdown-view";
import { Text } from "@/components/typography";
import type { CodexItem } from "@/lib/conversation";
import {
	conversationToolFailed,
	conversationToolTitle,
	conversationValueText,
} from "@/lib/conversation-presentation";
import { cn } from "@/lib/utils";

function ToolOutput({ label, value }: { label: string; value: unknown }) {
	const text = conversationValueText(value);
	if (!text) {
		return null;
	}
	return (
		<div className="min-w-0">
			<Text size="xs" tone="faint" className="mb-1">
				{label}
			</Text>
			<pre className="max-h-80 overflow-auto border border-border bg-background p-3 font-mono text-xs whitespace-pre-wrap break-words">
				{text}
			</pre>
		</div>
	);
}

export function ConversationTool({ item, active }: { item: CodexItem; active: boolean }) {
	const [expanded, setExpanded] = useState(false);
	const failed = conversationToolFailed(item);
	const running = active && item.status === "inProgress";
	const Icon = { commandExecution: Terminal, fileChange: FileDiff }[item.type] ?? Wrench;
	if (item.type === "reasoning") {
		const text =
			item.summary?.filter((part) => !!part.trim()).join("\n\n") ||
			item.content?.filter((part): part is string => typeof part === "string").join("\n\n");
		return (
			<details
				className="group min-w-0"
				onToggle={(event) => setExpanded(event.currentTarget.open)}
			>
				<summary className="flex min-h-11 cursor-pointer items-center gap-2 text-xs text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
					<ChevronRight className="size-3.5 shrink-0 transition-transform group-open:rotate-90" />
					Resumo do raciocínio
				</summary>
				{expanded && (
					<MarkdownView text={text ?? ""} className="pb-3 text-sm text-muted-foreground" />
				)}
			</details>
		);
	}
	if (item.type === "contextCompaction") {
		return (
			<Text size="xs" tone="faint" className="py-2">
				Contexto compactado
			</Text>
		);
	}
	return (
		<details
			onToggle={(event) => setExpanded(event.currentTarget.open)}
			data-item-id={item.id}
			data-item-type={item.type}
			className="group min-w-0 border border-border bg-card/40"
		>
			<summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
				<Icon className="size-3.5 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate">{conversationToolTitle(item)}</span>
				{typeof item.durationMs === "number" && (
					<span className="shrink-0 text-muted-foreground/60 tabular-nums">
						{(item.durationMs / 1000).toFixed(1)}s
					</span>
				)}
				{running && (
					<Loader2
						aria-label="Em execução"
						className="size-3.5 shrink-0 animate-spin text-primary"
					/>
				)}
				{!running && failed && (
					<TriangleAlert aria-label="Falhou" className="size-3.5 shrink-0 text-destructive" />
				)}
				{!running &&
					!failed &&
					(item.status === "completed" || typeof item.exitCode === "number") && (
						<Check aria-label="Concluído" className="size-3.5 shrink-0 text-muted-foreground" />
					)}
				<ChevronRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
			</summary>
			{expanded && (
				<div className="flex min-w-0 flex-col gap-3 border-t border-border p-3">
					{item.command && <ToolOutput label="Comando" value={item.command} />}
					{item.cwd && (
						<Text size="xs" tone="faint" className="break-all font-mono">
							{item.cwd}
						</Text>
					)}
					{item.arguments !== undefined && (
						<ToolOutput label="Entrada da ferramenta" value={item.arguments} />
					)}
					{item.text && <MarkdownView text={item.text} className="text-sm" />}
					{item.review && <MarkdownView text={item.review} className="text-sm" />}
					{item.prompt && <MarkdownView text={item.prompt} className="text-sm" />}
					{(item.query || item.action) && (
						<ToolOutput label="Pesquisa" value={item.action ?? item.query} />
					)}
					{item.path && (
						<Text size="xs" className="break-all font-mono">
							{item.path}
						</Text>
					)}
					{item.changes?.map((change, index) => (
						<div key={`${change.path}:${index}`} className="min-w-0">
							<Text size="xs" className="mb-1 break-all font-mono">
								{change.path}
							</Text>
							<ToolOutput label="Alterações" value={change.diff} />
						</div>
					))}
					<ToolOutput label="Saída" value={item.aggregatedOutput ?? item.output} />
					<ToolOutput label="Resultados da pesquisa" value={item.results} />
					<ToolOutput label="Agentes" value={item.agentsStates ?? item.receiverThreadIds} />
					{item.contentItems?.map((part, index) => (
						<ToolOutput key={index} label="Resultado" value={part.text ?? part} />
					))}
					{(typeof item.result === "object" ? item.result?.content : [])?.map((part, index) => (
						<ToolOutput key={index} label="Resultado" value={part.text ?? part} />
					))}
					<ToolOutput
						label="Resultado estruturado"
						value={typeof item.result === "object" ? item.result?.structuredContent : item.result}
					/>
					{item.error && (
						<Text role="alert" size="xs" tone="destructive">
							{item.error.message}
						</Text>
					)}
					{typeof item.exitCode === "number" && (
						<Text size="xs" className={cn("text-muted-foreground", failed && "text-destructive")}>
							Código de saída: {item.exitCode}
						</Text>
					)}
				</div>
			)}
		</details>
	);
}

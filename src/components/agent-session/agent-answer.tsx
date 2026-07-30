import { Expand, X } from "lucide-react";
import { useState } from "react";

import { MarkdownEditor } from "@/components/markdown-doc";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

const PREVIEW_LINES = 16;

type Block = { kind: "text" | "code"; content: string };

// A resposta chega em markdown, mas a conversa não comporta um leitor com rolagem própria dentro de
// cada turno: no celular dois scrolls empilhados brigam pelo toque. Aqui o texto flui na altura
// natural, o bloco cercado por crases vira código legível e o leitor completo abre sob demanda.
function toBlocks(output: string): Block[] {
	const blocks: Block[] = [];
	let buffer: string[] = [];
	let inCode = false;

	function flush(kind: Block["kind"]) {
		const content = buffer.join("\n").trim();
		buffer = [];
		if (content) {
			blocks.push({ kind, content });
		}
	}

	for (const line of output.split("\n")) {
		if (line.trimStart().startsWith("```")) {
			flush(inCode ? "code" : "text");
			inCode = !inCode;
			continue;
		}
		buffer.push(line);
	}
	flush(inCode ? "code" : "text");

	return blocks;
}

export function AgentAnswer({ runId, output }: { runId: string; output: string }) {
	const [reading, setReading] = useState(false);
	const [expanded, setExpanded] = useState(false);
	const blocks = toBlocks(output);
	const long = output.split("\n").length > PREVIEW_LINES || output.length > 1_400;

	return (
		<div className="min-w-0">
			<div
				className={
					expanded || !long
						? "min-w-0"
						: "relative min-w-0 max-h-72 overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-16 after:bg-gradient-to-t after:from-card after:to-transparent"
				}
			>
				{blocks.map((block, index) =>
					block.kind === "code" ? (
						<pre
							key={`${runId}-${index}`}
							className="my-3 overflow-x-auto border border-border bg-muted/40 p-3 font-mono text-[11px] leading-5"
						>
							{block.content}
						</pre>
					) : (
						<Text
							key={`${runId}-${index}`}
							className="my-2 whitespace-pre-wrap break-words text-[15px] leading-7"
						>
							{block.content}
						</Text>
					),
				)}
			</div>

			<div className="mt-3 flex flex-wrap items-center gap-2">
				{long && !expanded && (
					<Button variant="outline" size="sm" onClick={() => setExpanded(true)}>
						Ver resposta inteira
					</Button>
				)}
				<Button variant="ghost" size="sm" onClick={() => setReading(true)}>
					<Expand className="size-4" />
					Abrir no leitor
				</Button>
			</div>

			<Sheet open={reading} onOpenChange={setReading}>
				<SheetContent
					side="bottom"
					showClose={false}
					className="h-[94dvh] max-h-[94dvh] pb-[env(safe-area-inset-bottom)]"
				>
					<SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border px-4 py-2">
						<SheetTitle asChild>
							<Title as="h2" size="sm">
								Resposta do agente
							</Title>
						</SheetTitle>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setReading(false)}
							aria-label="Fechar leitor"
							className="size-11 shrink-0"
						>
							<X className="size-5" />
						</Button>
					</SheetHeader>
					<div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 py-4 [&_.cm-scroller]:touch-pan-y [&_.cm-scroller]:overflow-y-auto [&_.cm-scroller]:overscroll-contain md:px-6">
						<MarkdownEditor
							initialContent={output}
							onChange={() => {}}
							proseMaxWidth="48rem"
							readOnly
						/>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}

import { FileOutput } from "lucide-react";

import { MarkdownEditor } from "@/components/markdown-doc";
import { Text, Title } from "@/components/typography";

export function ExecutionResult({ runId, output }: { runId: string; output?: string }) {
	return (
		<section className="min-w-0 border border-border bg-card shadow-[4px_4px_0_var(--border)]">
			<div className="flex items-center gap-3 border-b border-border px-4 py-3">
				<span className="flex size-8 items-center justify-center border border-border bg-muted/40">
					<FileOutput className="size-4" />
				</span>
				<div>
					<Title as="h2" size="sm">
						Resultado
					</Title>
					<Text size="xs" tone="muted">
						Markdown renderizado pelo leitor do Koworker
					</Text>
				</div>
			</div>
			{output ? (
				<div className="flex h-[min(62vh,42rem)] min-h-80 flex-col overflow-hidden px-3 py-5 [&_.cm-scroller]:touch-pan-y [&_.cm-scroller]:overscroll-contain [&_.cm-scroller]:overflow-y-auto md:px-6">
					<MarkdownEditor
						key={`${runId}-${output.length}`}
						initialContent={output}
						onChange={() => {}}
						proseMaxWidth="48rem"
						readOnly
					/>
				</div>
			) : (
				<div className="flex min-h-48 items-center justify-center p-6 text-center">
					<Text tone="muted">O agente ainda não produziu um resultado.</Text>
				</div>
			)}
		</section>
	);
}

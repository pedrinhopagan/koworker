import { FileCode2, FileText } from "lucide-react";

import { Text } from "@/components/typography";
import { formatBytes } from "@/lib/format-bytes";
import { relativeTimeFrom } from "@/lib/relative-time";

// O artefato é o herói da página: card maior com ícone por tipo, badge textual (PDF/HTML) e o nome
// em destaque. Clicar abre o arquivo no app padrão do SO (mutation no pai).
type ArtifactCardProps = {
	artifact: { name: string; size: number; mtime: number; mime: string };
	onOpen: () => void;
};

export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
	const isPdf = artifact.mime === "application/pdf";

	return (
		<button
			type="button"
			onClick={onOpen}
			className="group flex flex-col gap-4 border border-border bg-card p-4 text-left transition-colors hover:border-[var(--project-accent,var(--primary))] hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
		>
			<div className="flex items-center justify-between gap-2">
				<span className="flex size-10 shrink-0 items-center justify-center border border-border bg-secondary/40 text-muted-foreground transition-colors group-hover:border-[var(--project-accent,var(--primary))] group-hover:text-foreground">
					{isPdf ? <FileText size={18} /> : <FileCode2 size={18} />}
				</span>
				<span className="border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase tracking-wider">
					{isPdf ? "PDF" : "HTML"}
				</span>
			</div>

			<div className="min-w-0">
				<Text
					size="sm"
					className="truncate font-medium transition-colors group-hover:text-foreground"
				>
					{artifact.name}
				</Text>
				<Text size="xs" tone="muted" className="truncate tabular-nums">
					{formatBytes(artifact.size)} · {relativeTimeFrom(artifact.mtime)}
				</Text>
			</div>
		</button>
	);
}

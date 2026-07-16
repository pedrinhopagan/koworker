import { ArrowUpRight, FileCode2, FileText } from "lucide-react";

import type { RouterOutputs } from "@/client";
import { Text, Title } from "@/components/typography";
import { formatBytes } from "@/lib/format-bytes";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type Artifact = RouterOutputs["mostruario"]["list"][number]["artifacts"][number];

type ArtifactCardProps = {
	artifact: Artifact;
	onOpen: () => void;
};

export function ArtifactCard({ artifact, onOpen }: ArtifactCardProps) {
	const isPdf = artifact.mime === "application/pdf";
	const title = artifact.metadata?.title ?? artifact.name;
	const showsFileName = title !== artifact.name;
	const headings = artifact.metadata?.headings ?? [];
	const hasContext = !!artifact.metadata?.subtitle || headings.length > 0;

	return (
		<button
			type="button"
			onClick={onOpen}
			className={cn(
				"group relative flex flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-[var(--project-accent,var(--primary))] hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				hasContext ? "min-h-64" : "min-h-44",
			)}
		>
			<span className="absolute inset-y-0 left-0 w-0.5 origin-bottom scale-y-0 bg-[var(--project-accent,var(--primary))] transition-transform duration-150 group-hover:scale-y-100" />

			<div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
				<div className="flex min-w-0 items-center gap-3">
					<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground transition-colors group-hover:border-[var(--project-accent,var(--primary))] group-hover:text-foreground">
						{isPdf ? <FileText size={18} /> : <FileCode2 size={18} />}
					</span>
					<div className="min-w-0">
						<Text size="xs" tone="muted" className="truncate uppercase tracking-[0.14em]">
							{isPdf ? "Documento PDF" : "Apresentação HTML"}
						</Text>
						<Text size="xs" tone="muted" className="truncate tabular-nums">
							{relativeTimeFrom(artifact.mtime)}
						</Text>
					</div>
				</div>
				<ArrowUpRight
					size={17}
					className="shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground"
				/>
			</div>

			<div className="flex flex-1 flex-col gap-4 px-5 py-5">
				<div className="flex flex-col gap-1.5">
					<Title
						as="span"
						size="sm"
						className="line-clamp-2 text-base leading-snug transition-colors group-hover:text-foreground"
					>
						{title}
					</Title>
					{showsFileName && (
						<Text size="xs" tone="muted" className="truncate font-mono">
							{artifact.name}
						</Text>
					)}
				</div>

				{artifact.metadata?.subtitle && (
					<Text size="sm" tone="muted" className="line-clamp-3 leading-relaxed">
						{artifact.metadata.subtitle}
					</Text>
				)}

				{headings.length > 0 && (
					<ul className="flex flex-col gap-2 border-t border-border pt-4">
						{headings.map((heading, index) => (
							<li
								key={`${heading}-${index}`}
								className="flex items-start gap-2.5 text-sm text-muted-foreground"
							>
								<span className="mt-2 size-1.5 shrink-0 bg-[var(--project-accent,var(--primary))]" />
								<span className="line-clamp-1">{heading}</span>
							</li>
						))}
					</ul>
				)}

				<Text size="xs" tone="muted" className="mt-auto pt-1 tabular-nums">
					{formatBytes(artifact.size)}
				</Text>
			</div>
		</button>
	);
}

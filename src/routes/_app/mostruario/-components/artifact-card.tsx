import { ArrowUpRight } from "lucide-react";
import type { MouseEventHandler } from "react";

import type { RouterOutputs } from "@/client";
import { HtmlCardPreview } from "@/components/artifacts/html-artifact-card";
import { Text, Title } from "@/components/typography";
import { filePresentation } from "@/constants/file-presentation";
import { formatBytes } from "@/lib/format-bytes";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

type Artifact = RouterOutputs["mostruario"]["list"][number]["artifacts"][number];

type ArtifactCardProps = {
	artifact: Artifact;
	path?: string;
	onOpen: MouseEventHandler<HTMLButtonElement>;
	onAuxClick: MouseEventHandler<HTMLButtonElement>;
};

export function ArtifactCard({ artifact, path, onOpen, onAuxClick }: ArtifactCardProps) {
	const { icon: Icon, label } = filePresentation(artifact.mime);
	const title = artifact.metadata?.title ?? artifact.name;
	const showsFileName = title !== artifact.name;
	const headings = artifact.metadata?.headings ?? [];
	const hasPreview = artifact.mime === "text/html" && !!path;
	const hasContext = !!artifact.metadata?.subtitle || headings.length > 0;

	return (
		<button
			type="button"
			onClick={onOpen}
			onAuxClick={onAuxClick}
			aria-label={title}
			className={cn(
				"group relative isolate flex flex-col overflow-hidden border border-border bg-card text-left transition-colors hover:border-[var(--project-accent,var(--primary))] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
				!hasPreview && "hover:bg-muted/30",
				hasContext ? "min-h-64" : "min-h-44",
			)}
		>
			{hasPreview && path && (
				<HtmlCardPreview path={path} name={artifact.name} mtime={artifact.mtime} />
			)}
			<div
				className={cn(
					"relative z-10 flex flex-1 flex-col",
					hasPreview &&
						"bg-card/90 transition-opacity duration-150 group-hover:opacity-0 motion-reduce:transition-none",
				)}
			>
				<span className="absolute inset-y-0 left-0 w-0.5 origin-bottom scale-y-0 bg-[var(--project-accent,var(--primary))] transition-transform duration-150 group-hover:scale-y-100" />

				<div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
					<div className="flex min-w-0 items-center gap-3">
						<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground transition-colors group-hover:border-[var(--project-accent,var(--primary))] group-hover:text-foreground">
							<Icon size={18} />
						</span>
						<div className="min-w-0">
							<Text size="xs" tone="muted" className="truncate uppercase tracking-[0.14em]">
								{label}
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

					{artifact.match && (
						<Text
							size="sm"
							tone="muted"
							className="line-clamp-4 border-l-2 border-primary/40 pl-3 leading-relaxed"
						>
							{artifact.match.snippet.split(/([\p{L}\p{N}]+)/u).map((part, index) => {
								const matched = artifact.match?.words.includes(
									part.normalize("NFD").replaceAll(/\p{M}/gu, "").toLowerCase(),
								);
								if (matched) {
									return (
										<mark key={index} className="bg-primary/15 text-foreground">
											{part}
										</mark>
									);
								}
								return part;
							})}
						</Text>
					)}

					{!artifact.match && artifact.metadata?.subtitle && (
						<Text size="sm" tone="muted" className="line-clamp-3 leading-relaxed">
							{artifact.metadata.subtitle}
						</Text>
					)}

					{!artifact.match && headings.length > 0 && (
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
			</div>
		</button>
	);
}

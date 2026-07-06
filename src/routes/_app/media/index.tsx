import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCode2, FileText, Image, Loader2 } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { relativeTimeFrom } from "@/lib/relative-time";
import { formatBytes } from "@/lib/format-bytes";

export const Route = createFileRoute("/_app/media/")({
	component: MediaPage,
});

function MediaPage() {
	const { selectedProjectId } = useProjectFocus();
	const allProjects = selectedProjectId === undefined;

	const mediaQuery = useQuery({
		...orpc.media.list.queryOptions({ input: { projectId: selectedProjectId } }),
		enabled: selectedProjectId !== null,
	});

	const entries = mediaQuery.data?.entries ?? [];

	return (
		<PageShell
			icon={Image}
			title="Mídia"
			description="Arquivos soltos em .koworker/medias/ de cada projeto"
		>
			{mediaQuery.isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 size={18} className="animate-spin text-muted-foreground" />
				</div>
			) : entries.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-2">
					<Text size="sm" tone="muted">
						Nenhuma mídia neste projeto.
					</Text>
					<Text size="xs" tone="muted">
						Solte arquivos (.pdf, .html) em <code>.koworker/medias/</code>.
					</Text>
				</div>
			) : (
				<div className="grid grid-cols-1 gap-3 pb-6 sm:grid-cols-2 lg:grid-cols-3">
					{entries.map((entry) => (
						<Link
							key={`${entry.projectId}/${entry.name}`}
							to="/media/$fileName"
							params={{ fileName: entry.name }}
							search={{ projectId: entry.projectId }}
							className="group flex items-start gap-3 border border-border p-3 transition-colors hover:border-[var(--project-accent,var(--primary))] hover:bg-muted/30"
						>
							<AssetIcon mime={entry.mime} />
							<div className="min-w-0 flex-1">
								<Text size="sm" className="truncate font-medium group-hover:text-foreground">
									{entry.name}
								</Text>
								<Text size="xs" tone="muted" className="truncate">
									{formatBytes(entry.size)} · {relativeTimeFrom(entry.mtime)}
									{allProjects ? ` · ${entry.projectName}` : ""}
								</Text>
							</div>
						</Link>
					))}
				</div>
			)}
		</PageShell>
	);
}

function AssetIcon({ mime }: { mime: string }) {
	const Icon = mime === "application/pdf" ? FileText : FileCode2;
	return (
		<span className="flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground">
			<Icon size={18} />
		</span>
	);
}

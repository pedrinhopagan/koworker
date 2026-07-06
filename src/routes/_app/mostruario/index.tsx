import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileCode2, FileText, Loader2, Presentation } from "lucide-react";

import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { formatBytes } from "@/lib/format-bytes";
import { relativeTimeFrom } from "@/lib/relative-time";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/mostruario/")({
	component: MostruarioPage,
});

function MostruarioPage() {
	const { selectedProjectId } = useProjectFocus();
	const allProjects = selectedProjectId === undefined;

	const mostruarioQuery = useQuery({
		...orpc.mostruario.list.queryOptions({ input: { projectId: selectedProjectId } }),
		enabled: selectedProjectId !== null,
	});

	const entries = mostruarioQuery.data?.entries ?? [];

	return (
		<PageShell
			icon={Presentation}
			title="Mostruário"
			description="Apresentações e documentos renderizados de cada tarefa"
		>
			{mostruarioQuery.isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 size={18} className="animate-spin text-muted-foreground" />
				</div>
			) : entries.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-2">
					<Text size="sm" tone="muted">
						Nenhum artefato no mostruário.
					</Text>
					<Text size="xs" tone="muted">
						Mova um .html/.pdf de uma tarefa ou gere direto em{" "}
						<code>.koworker/mostruario/&lt;id&gt;/</code>.
					</Text>
				</div>
			) : (
				<div className="flex flex-col gap-6 pb-6">
					{entries.map((entry) => (
						<section key={`${entry.projectId}/${entry.taskFolder}`}>
							<div className="mb-2 flex items-baseline gap-2 border-b border-border pb-1.5">
								{entry.taskId ? (
									<Link
										to="/tarefas/$taskId"
										params={{ taskId: entry.taskId }}
										className="min-w-0 truncate font-medium text-sm hover:text-[var(--project-accent,var(--primary))]"
									>
										{entry.title}
									</Link>
								) : (
									<Text size="sm" className="min-w-0 truncate font-medium">
										{entry.title}
									</Text>
								)}
								<Text size="xs" tone="muted" className="shrink-0">
									{relativeTimeFrom(entry.lastEditedAt)}
									{allProjects ? ` · ${entry.projectName}` : ""}
								</Text>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{entry.files.map((file) => (
									<Link
										key={file.name}
										to="/mostruario/$taskFolder/$fileName"
										params={{ taskFolder: entry.taskFolder, fileName: file.name }}
										search={{ projectId: entry.projectId }}
										className="group flex items-start gap-3 border border-border p-3 transition-colors hover:border-[var(--project-accent,var(--primary))] hover:bg-muted/30"
									>
										<AssetIcon mime={file.mime} />
										<div className="min-w-0 flex-1">
											<Text size="sm" className="truncate font-medium group-hover:text-foreground">
												{file.name}
											</Text>
											<Text size="xs" tone="muted" className="truncate">
												{formatBytes(file.size)} · {relativeTimeFrom(file.mtime)}
											</Text>
										</div>
									</Link>
								))}
							</div>
						</section>
					))}
				</div>
			)}
		</PageShell>
	);
}

function AssetIcon({ mime, className }: { mime: string; className?: string }) {
	const Icon = mime === "application/pdf" ? FileText : FileCode2;
	return (
		<span
			className={cn(
				"flex size-9 shrink-0 items-center justify-center border border-border bg-muted/40 text-muted-foreground",
				className,
			)}
		>
			<Icon size={18} />
		</span>
	);
}

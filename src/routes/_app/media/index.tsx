import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Image, ImageOff, Loader2 } from "lucide-react";
import { useRef } from "react";
import { z } from "zod";

import { orpc, type RouterOutputs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text, Title } from "@/components/typography";
import { Pagination } from "@/components/ui/pagination";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { MediaCard } from "./-components/media-card";

const MEDIA_PAGE_SIZE = 12;

const searchSchema = z.object({
	page: z.coerce.number().int().min(1).optional().default(1),
});

export const Route = createFileRoute("/_app/media/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: MediaPage,
});

type MediaEntry = RouterOutputs["media"]["list"]["entries"][number];

type MediaGroup = {
	key: string;
	projectName: string;
	taskId: string | null;
	taskTitle: string | null;
	latestMtime: number;
	totalEntries: number;
	entries: MediaEntry[];
};

function groupMedia(entries: MediaEntry[], totals?: Map<string, number>): MediaGroup[] {
	const groups = new Map<string, MediaGroup>();

	for (const entry of entries) {
		const key = `${entry.projectId}/${entry.taskId || "project"}`;
		const group = groups.get(key);

		if (group) {
			group.entries.push(entry);
			group.latestMtime = Math.max(group.latestMtime, entry.mtime);
			continue;
		}

		groups.set(key, {
			key,
			projectName: entry.projectName,
			taskId: entry.taskId,
			taskTitle: entry.taskTitle,
			latestMtime: entry.mtime,
			totalEntries: totals?.get(key) ?? 1,
			entries: [entry],
		});
	}

	return [...groups.values()].sort((a, b) => b.latestMtime - a.latestMtime);
}

function MediaPage() {
	const galleryRef = useRef<HTMLDivElement>(null);
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const { selectedProjectId } = useProjectFocus();
	const projectInput = selectedProjectId ? { projectId: selectedProjectId } : {};
	const mediaQuery = useQuery({
		...orpc.media.list.queryOptions({ input: projectInput }),
		enabled: selectedProjectId !== null,
	});
	const allGroups = groupMedia(mediaQuery.data?.entries ?? []);
	const entries = allGroups.flatMap((group) => group.entries);
	const totalPages = Math.max(1, Math.ceil(entries.length / MEDIA_PAGE_SIZE));
	const page = Math.min(search.page, totalPages);
	const totals = new Map(allGroups.map((group) => [group.key, group.entries.length]));
	const groups = groupMedia(
		entries.slice((page - 1) * MEDIA_PAGE_SIZE, page * MEDIA_PAGE_SIZE),
		totals,
	);
	const showProject = selectedProjectId === undefined;

	function handlePageChange(nextPage: number) {
		galleryRef.current?.scrollIntoView({ block: "start" });
		navigate({ search: { page: nextPage }, replace: true });
	}

	return (
		<PageShell
			icon={Image}
			title="Mídia"
			description="Imagens das tarefas e da pasta .koworker/medias"
			contentClassName="min-h-0 flex-1 overflow-y-auto px-4 pb-12"
		>
			{mediaQuery.isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 className="size-5 animate-spin text-muted-foreground" />
				</div>
			) : entries.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-3 text-center">
					<span className="flex size-12 items-center justify-center border border-border text-muted-foreground">
						<ImageOff className="size-5" />
					</span>
					<div>
						<Text size="sm" tone="muted">
							Nenhuma imagem neste projeto.
						</Text>
						<Text size="xs" tone="muted">
							Adicione imagens a uma tarefa ou cole uma imagem no prompt.
						</Text>
					</div>
				</div>
			) : (
				<div ref={galleryRef} className="mx-auto flex w-full max-w-7xl flex-col gap-10">
					{groups.map((group, index) => (
						<section key={group.key} className="flex flex-col gap-4">
							<header className="flex items-end gap-3 border-b border-border pb-3">
								<Text
									as="span"
									size="xs"
									tone="muted"
									className="flex size-7 shrink-0 items-center justify-center border border-border font-mono tabular-nums"
								>
									{String(index + 1).padStart(2, "0")}
								</Text>
								<div className="min-w-0 flex-1">
									<Text size="xs" tone="muted" className="uppercase tracking-[0.16em]">
										{group.taskId ? "Tarefa" : "Mídia avulsa"}
										{showProject ? ` · ${group.projectName}` : ""}
									</Text>
									{group.taskId ? (
										<Link to="/tarefas/$taskId" params={{ taskId: group.taskId }}>
											<Title
												as="span"
												size="sm"
												className="block truncate font-normal transition-colors hover:text-[var(--project-accent,var(--primary))]"
											>
												{group.taskTitle || "Tarefa sem título"}
											</Title>
										</Link>
									) : (
										<Title as="h2" size="sm" className="font-normal">
											Imagens do projeto
										</Title>
									)}
								</div>
								<Text size="xs" tone="muted" className="shrink-0 tabular-nums">
									{group.entries.length < group.totalEntries
										? `${group.entries.length} de ${group.totalEntries} imagens`
										: `${group.totalEntries} ${group.totalEntries === 1 ? "imagem" : "imagens"}`}
								</Text>
							</header>

							<div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3">
								{group.entries.map((entry) => (
									<MediaCard
										key={`${entry.projectId}/${entry.taskId || "project"}/${entry.name}`}
										entry={entry}
									/>
								))}
							</div>
						</section>
					))}

					<Pagination
						page={page}
						totalPages={totalPages}
						total={entries.length}
						onPageChange={handlePageChange}
						className="border border-border bg-background"
						singularLabel="imagem"
						pluralLabel="imagens"
					/>
				</div>
			)}
		</PageShell>
	);
}

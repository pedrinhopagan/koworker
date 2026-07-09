import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Image, ImageOff, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { Tooltip } from "@/components/ui/tooltip";
import { useObjectUrl } from "@/hooks/use-object-url";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { imagePlaceholder } from "@/lib/build-prompt";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

export const Route = createFileRoute("/_app/media/")({
	component: MediaPage,
});

type MediaEntry = RouterOutputs["media"]["list"]["entries"][number];

function dayKeyOf(time: number): string {
	const date = new Date(time);
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${date.getFullYear()}-${month}-${day}`;
}

function dayLabelOf(key: string): string {
	const now = new Date();
	if (key === dayKeyOf(now.getTime())) return "Hoje";
	if (key === dayKeyOf(now.getTime() - 86_400_000)) return "Ontem";

	// Meio-dia local evita a data escorregar de dia por fuso ao parsear o key.
	const date = new Date(`${key}T12:00:00`);
	const label = date.toLocaleDateString("pt-BR", {
		weekday: "long",
		day: "numeric",
		month: "long",
		...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
	});
	return label.charAt(0).toUpperCase() + label.slice(1);
}

// Entries já vêm ordenadas por mtime desc dentro de cada projeto; o sort global garante a ordem no
// modo "Todos os projetos" e o reduce preserva os dias do mais recente pro mais antigo.
function groupByDay(entries: MediaEntry[]): { key: string; entries: MediaEntry[] }[] {
	const sorted = [...entries].sort((a, b) => b.mtime - a.mtime);
	const groups: { key: string; entries: MediaEntry[] }[] = [];

	for (const entry of sorted) {
		const key = dayKeyOf(entry.mtime);
		const last = groups.at(-1);
		if (last?.key === key) {
			last.entries.push(entry);
		} else {
			groups.push({ key, entries: [entry] });
		}
	}

	return groups;
}

function MediaPage() {
	const { selectedProjectId } = useProjectFocus();
	const allProjects = selectedProjectId === undefined;

	const mediaQuery = useQuery({
		...orpc.media.list.queryOptions({ input: { projectId: selectedProjectId } }),
		enabled: selectedProjectId !== null,
	});

	const groups = groupByDay(mediaQuery.data?.entries ?? []);

	return (
		<PageShell
			icon={Image}
			title="Mídia"
			description="Imagens em .koworker/medias/ de cada projeto, por dia de inserção"
		>
			{mediaQuery.isLoading ? (
				<div className="flex h-full items-center justify-center">
					<Loader2 size={18} className="animate-spin text-muted-foreground" />
				</div>
			) : groups.length === 0 ? (
				<div className="flex h-full flex-col items-center justify-center gap-2">
					<Text size="sm" tone="muted">
						Nenhuma mídia neste projeto.
					</Text>
					<Text size="xs" tone="muted">
						Cole uma imagem no prompt ou solte arquivos em <code>.koworker/medias/</code>.
					</Text>
				</div>
			) : (
				<div className="flex flex-col gap-6 pb-6">
					{groups.map((group) => (
						<section key={group.key}>
							<div className="mb-2 flex items-baseline gap-2 border-b border-border pb-1.5">
								<Text size="sm" className="font-medium">
									{dayLabelOf(group.key)}
								</Text>
								<Text size="xs" tone="muted">
									{group.entries.length} {group.entries.length === 1 ? "imagem" : "imagens"}
								</Text>
							</div>
							<div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3">
								{group.entries.map((entry) => (
									<MediaCard
										key={`${entry.projectId}/${entry.name}`}
										entry={entry}
										showProject={allProjects}
									/>
								))}
							</div>
						</section>
					))}
				</div>
			)}
		</PageShell>
	);
}

function MediaCard({ entry, showProject }: { entry: MediaEntry; showProject: boolean }) {
	const queryClient = useQueryClient();
	const fileQuery = useQuery(
		orpc.media.readFile.queryOptions({
			input: { projectId: entry.projectId, name: entry.name },
		}),
	);
	const url = useObjectUrl(fileQuery.data);

	// Anexa a imagem ao rascunho do prompt global: registra no store e apensa o marcador dela ao
	// texto — o mesmo caminho de uma imagem colada, só que partindo da vitrine.
	function handleAddToPrompt() {
		const { addImage, appendMention } = usePromptBarStore.getState();
		const index = addImage({ projectId: entry.projectId, name: entry.name });
		appendMention(imagePlaceholder(index));
		toast.success(`${imagePlaceholder(index)} anexada ao prompt`);
	}

	// Exclusão confirmada no próprio ícone: 1º clique arma (lixeira → check) e dá 3s pra desarmar
	// sozinho; 2º clique dentro da janela apaga de fato. Sem diálogo, sem sair do card.
	const [armed, setArmed] = useState(false);
	const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		return () => {
			if (disarmTimer.current) clearTimeout(disarmTimer.current);
		};
	}, []);

	const deleteMutation = useMutation({
		...orpc.media.deleteFile.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({
				predicate: (query) => Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "media",
			});
			toast.success("Imagem excluída");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível excluir a imagem"),
	});

	function handleDeleteClick() {
		if (disarmTimer.current) clearTimeout(disarmTimer.current);
		if (!armed) {
			setArmed(true);
			disarmTimer.current = setTimeout(() => setArmed(false), 3000);
			return;
		}
		setArmed(false);
		deleteMutation.mutate({ projectId: entry.projectId, name: entry.name });
	}

	return (
		<div className="group relative border border-border transition-colors hover:border-[var(--project-accent,var(--primary))]">
			<Link
				to="/media/$fileName"
				params={{ fileName: entry.name }}
				search={{ projectId: entry.projectId }}
				className="block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<div className="flex aspect-square items-center justify-center overflow-hidden bg-muted/40">
					{url ? (
						<img
							src={url}
							alt={entry.name}
							loading="lazy"
							className="size-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
						/>
					) : fileQuery.isLoading ? (
						<Loader2 size={16} className="animate-spin text-muted-foreground/60" />
					) : (
						<ImageOff size={16} className="text-muted-foreground/60" />
					)}
				</div>
				<div className="border-t border-border p-2">
					<Text size="xs" className="truncate font-medium">
						{entry.name}
					</Text>
					<Text size="xs" tone="muted" className="truncate">
						{formatBytes(entry.size)}
						{showProject ? ` · ${entry.projectName}` : ""}
					</Text>
				</div>
			</Link>

			<Tooltip
				label={armed ? "Confirmar exclusão" : "Excluir imagem"}
				triggerClassName={cn(
					"absolute left-1.5 top-1.5 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
					armed || deleteMutation.isPending ? "opacity-100" : "opacity-0",
				)}
			>
				<button
					type="button"
					onClick={handleDeleteClick}
					disabled={deleteMutation.isPending}
					aria-label={armed ? `Confirmar exclusão de ${entry.name}` : `Excluir ${entry.name}`}
					className={cn(
						"flex size-7 items-center justify-center border bg-background/90 backdrop-blur-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
						armed
							? "border-destructive/40 text-destructive hover:bg-destructive/10"
							: "border-border text-muted-foreground hover:text-destructive",
					)}
				>
					{deleteMutation.isPending ? (
						<Loader2 className="size-4 animate-spin" />
					) : armed ? (
						<Check className="size-4" />
					) : (
						<Trash2 className="size-4" />
					)}
				</button>
			</Tooltip>

			<Tooltip
				label="Usar no prompt"
				triggerClassName="absolute right-1.5 top-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
			>
				<button
					type="button"
					onClick={handleAddToPrompt}
					aria-label={`Usar ${entry.name} no prompt`}
					className="flex size-7 items-center justify-center border border-border bg-background/90 text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<MessageSquarePlus className="size-4" />
				</button>
			</Tooltip>
		</div>
	);
}

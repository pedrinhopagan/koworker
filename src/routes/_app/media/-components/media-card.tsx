import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, ImageOff, Loader2, MessageSquarePlus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { Text } from "@/components/typography";
import { Tooltip } from "@/components/ui/tooltip";
import { useObjectUrl } from "@/hooks/use-object-url";
import { imagePlaceholder } from "@/lib/build-prompt";
import { formatBytes } from "@/lib/format-bytes";
import { cn } from "@/lib/utils";
import { usePromptBarStore } from "@/stores/prompt-bar";

type MediaEntry = RouterOutputs["media"]["list"]["entries"][number];

export function MediaCard({ entry }: { entry: MediaEntry }) {
	const queryClient = useQueryClient();
	const cardRef = useRef<HTMLDivElement>(null);
	const disarmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const [visible, setVisible] = useState(false);
	const [armed, setArmed] = useState(false);
	const [failedUrl, setFailedUrl] = useState<string | null>(null);
	const readInput = entry.taskId
		? { projectId: entry.projectId, taskId: entry.taskId, name: entry.name }
		: { projectId: entry.projectId, name: entry.name };
	const search = entry.taskId
		? { projectId: entry.projectId, taskId: entry.taskId }
		: { projectId: entry.projectId };
	const fileQueryOptions = orpc.media.readPreview.queryOptions({ input: readInput });
	const fileQuery = useQuery({
		...fileQueryOptions,
		queryKey: [...fileQueryOptions.queryKey, entry.mtime, entry.size],
		enabled: visible,
		gcTime: 0,
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});
	const url = useObjectUrl(fileQuery.data);

	useEffect(() => {
		const card = cardRef.current;
		if (!card || visible) {
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0]?.isIntersecting) {
					setVisible(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "0px" },
		);
		observer.observe(card);

		return () => observer.disconnect();
	}, [visible]);

	useEffect(() => {
		return () => {
			if (disarmTimer.current) {
				clearTimeout(disarmTimer.current);
			}
		};
	}, []);

	const deleteMutation = useMutation({
		...orpc.media.deleteFile.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.media.list.key() });
			toast.success("Imagem excluída");
		},
		onError: (err) =>
			toast.error(err instanceof Error ? err.message : "Não foi possível excluir a imagem"),
	});

	function handleAddToPrompt() {
		const { addImage, appendMention } = usePromptBarStore.getState();
		const index = addImage({ projectId: entry.projectId, name: entry.name });
		appendMention(imagePlaceholder(index));
		toast.success(`${imagePlaceholder(index)} anexada ao prompt`);
	}

	function handleDeleteClick() {
		if (disarmTimer.current) {
			clearTimeout(disarmTimer.current);
		}
		if (!armed) {
			setArmed(true);
			disarmTimer.current = setTimeout(() => setArmed(false), 3000);
			return;
		}

		setArmed(false);
		deleteMutation.mutate({ projectId: entry.projectId, name: entry.name });
	}

	return (
		<div
			ref={cardRef}
			className="group relative min-w-0 border border-border bg-background transition-colors hover:border-[var(--project-accent,var(--primary))]"
		>
			<Link
				to="/media/$fileName"
				params={{ fileName: entry.name }}
				search={search}
				className="block focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
			>
				<div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-muted/30">
					{url && failedUrl !== url ? (
						<img
							src={url}
							alt={entry.name}
							loading="lazy"
							decoding="async"
							onError={() => setFailedUrl(url)}
							className="size-full object-cover object-top transition-transform duration-200 group-hover:scale-[1.02]"
						/>
					) : fileQuery.isFetching || !visible ? (
						<Loader2 className="size-4 animate-spin text-muted-foreground/60" />
					) : (
						<ImageOff className="size-4 text-muted-foreground/60" />
					)}
				</div>
				<div className="border-t border-border px-2.5 py-2">
					<Text size="xs" className="truncate font-medium">
						{entry.name}
					</Text>
					<Text size="xs" tone="muted" className="tabular-nums">
						{formatBytes(entry.size)}
					</Text>
				</div>
			</Link>

			{entry.taskId === null && (
				<>
					<Tooltip
						label={armed ? "Confirmar exclusão" : "Excluir imagem"}
						triggerClassName={cn(
							"absolute left-1.5 top-1.5 transition-opacity md:group-focus-within:opacity-100 md:group-hover:opacity-100",
							armed || deleteMutation.isPending ? "opacity-100" : "opacity-100 md:opacity-0",
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
						triggerClassName="absolute right-1.5 top-1.5 opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
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
				</>
			)}
		</div>
	);
}

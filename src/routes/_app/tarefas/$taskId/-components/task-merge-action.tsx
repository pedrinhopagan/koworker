import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ExternalLink, GitMerge, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";

export function TaskMergeAction({
	taskId,
	projectId,
	folderPath,
	branch,
	targetBranch,
	prUrl,
}: {
	taskId: string;
	projectId: string;
	folderPath: string;
	branch: string;
	targetBranch: string;
	prUrl: string;
}) {
	const navigate = useNavigate();
	const mergeMutation = useMutation({
		...orpc.prompt.execute.mutationOptions(),
		onSuccess: ({ runId }) => {
			localStorage.setItem("kowork-active-run", runId);
			toast.success("Merge despachado");
			void navigate({
				to: "/executar",
				search: { projectId, taskId, runId },
			});
		},
		onError: (error: Error) => toast.error(error.message),
	});

	function merge() {
		mergeMutation.mutate({
			clientRequestId: crypto.randomUUID(),
			projectId,
			taskId,
			prompt: `$kw ${folderPath} $merge-worktree`,
			originalPrompt: "Mergear PR",
			source: "task_flow",
			interactionMode: "unattended",
			inputKind: "task_flow",
			cli: "codex",
			model: "gpt-5.6",
			effort: "low",
			approvalMode: "bypass",
		});
	}

	return (
		<div
			role="status"
			aria-live="polite"
			aria-busy={mergeMutation.isPending}
			className="absolute right-4 bottom-4 z-20 flex max-w-[calc(100%-2rem)] items-center gap-4 border border-primary bg-background p-3 shadow-[4px_4px_0_0_var(--primary)]"
		>
			<div className="hidden min-w-0 sm:block">
				<div className="flex items-center gap-2">
					<GitMerge className="size-4 shrink-0 text-primary" />
					<Text size="sm" className="font-semibold">
						Execução concluída
					</Text>
				</div>
				<Text size="xs" tone="muted" className="mt-0.5 max-w-80 truncate">
					{branch} pronta para {targetBranch}
				</Text>
			</div>
			<Button asChild variant="ghost" size="icon-sm" aria-label="Abrir PR em nova aba">
				<a href={prUrl} target="_blank" rel="noreferrer">
					<ExternalLink className="size-4" />
				</a>
			</Button>
			<Button onClick={merge} disabled={mergeMutation.isPending} className="shrink-0">
				{mergeMutation.isPending ? (
					<Loader2 className="size-4 animate-spin" />
				) : (
					<GitMerge className="size-4" />
				)}
				{mergeMutation.isPending ? "Mergeando PR" : "Mergear PR"}
			</Button>
		</div>
	);
}

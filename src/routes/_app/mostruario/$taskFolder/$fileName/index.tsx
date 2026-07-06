import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { SquareArrowOutUpRight } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { orpc } from "@/client";
import { AssetViewerPage } from "@/components/asset-viewer";
import { MOSTRUARIO_DIRNAME } from "@/constants/koworker";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { joinPath, openFolderInOs } from "@/lib/os-share";

const searchSchema = z.object({
	projectId: z.string().min(1),
});

export const Route = createFileRoute("/_app/mostruario/$taskFolder/$fileName/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: MostruarioFilePage,
});

function MostruarioFilePage() {
	const { taskFolder, fileName } = Route.useParams();
	const { projectId } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { projects } = useProjectFocus();

	const project = projects.find((candidate) => candidate.id === projectId) ?? null;

	const fileQuery = useQuery(
		orpc.mostruario.readFile.queryOptions({ input: { projectId, taskFolder, name: fileName } }),
	);

	// A lista (cacheada da página do mostruário) resolve o taskId pra ligar de volta à tarefa pelo
	// id curto compartilhado. Sem cache/sem tarefa correspondente, o link só não aparece.
	const listQuery = useQuery({
		...orpc.mostruario.list.queryOptions({ input: { projectId } }),
		enabled: Boolean(projectId),
	});
	const taskId =
		listQuery.data?.entries.find((entry) => entry.taskFolder === taskFolder)?.taskId ?? null;

	function invalidateMostruario() {
		queryClient.invalidateQueries({
			predicate: (query) =>
				Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "mostruario",
		});
	}

	const deleteMutation = useMutation({
		...orpc.mostruario.deleteFile.mutationOptions(),
		onSuccess: () => {
			invalidateMostruario();
			toast.success("Arquivo deletado");
			navigate({ to: "/mostruario" });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao deletar"),
	});

	const renameMutation = useMutation({
		...orpc.mostruario.renameFile.mutationOptions(),
		onSuccess: (result) => {
			invalidateMostruario();
			toast.success("Arquivo renomeado");
			navigate({
				to: "/mostruario/$taskFolder/$fileName",
				params: { taskFolder, fileName: result.newName },
				search: { projectId },
			});
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear"),
	});

	const openInOs = project
		? () =>
				void openFolderInOs(
					joinPath(project.mainRoute, `.koworker/${MOSTRUARIO_DIRNAME}/${taskFolder}/${fileName}`),
				)
		: undefined;

	return (
		<AssetViewerPage
			name={fileName}
			blob={fileQuery.data}
			isLoading={fileQuery.isLoading}
			isError={fileQuery.isError}
			onBack={() => navigate({ to: "/mostruario" })}
			onOpenInOs={openInOs}
			onRename={(newName) =>
				renameMutation.mutate({ projectId, taskFolder, oldName: fileName, newName })
			}
			onDelete={() => deleteMutation.mutate({ projectId, taskFolder, name: fileName })}
			deleting={deleteMutation.isPending}
			headerExtra={
				taskId ? (
					<Link
						to="/tarefas/$taskId"
						params={{ taskId }}
						className="flex shrink-0 items-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
					>
						<SquareArrowOutUpRight size={13} />
						Ver tarefa
					</Link>
				) : null
			}
		/>
	);
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { orpc } from "@/client";
import { AssetViewerPage } from "@/components/asset-viewer";
import { MEDIAS_DIRNAME } from "@/constants/koworker";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { joinPath, openFolderInOs } from "@/lib/os-share";

const searchSchema = z.object({
	projectId: z.string().min(1),
	taskId: z.string().min(1).optional(),
});

export const Route = createFileRoute("/_app/media/$fileName/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: MediaFilePage,
});

function MediaFilePage() {
	const { fileName } = Route.useParams();
	const { projectId, taskId } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { projects } = useProjectFocus();

	const project = projects.find((candidate) => candidate.id === projectId) ?? null;

	const readInput = taskId ? { projectId, taskId, name: fileName } : { projectId, name: fileName };
	const fileQuery = useQuery({
		...orpc.media.readFile.queryOptions({ input: readInput }),
		gcTime: 0,
	});

	function invalidateMedia() {
		queryClient.invalidateQueries({ queryKey: orpc.media.list.key() });
	}

	const deleteMutation = useMutation({
		...orpc.media.deleteFile.mutationOptions(),
		onSuccess: () => {
			invalidateMedia();
			toast.success("Arquivo deletado");
			navigate({ to: "/media", search: { page: 1 } });
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao deletar"),
	});

	const renameMutation = useMutation({
		...orpc.media.renameFile.mutationOptions(),
		onSuccess: (result) => {
			invalidateMedia();
			toast.success("Arquivo renomeado");
			navigate({
				to: "/media/$fileName",
				params: { fileName: result.newName },
				search: { projectId },
			});
		},
		onError: (err) => toast.error(err instanceof Error ? err.message : "Falha ao renomear"),
	});

	const openInOs =
		project && !taskId
			? () =>
					void openFolderInOs(
						joinPath(project.mainRoute, `.koworker/${MEDIAS_DIRNAME}/${fileName}`),
					)
			: undefined;

	return (
		<AssetViewerPage
			name={fileName}
			blob={fileQuery.data}
			isLoading={fileQuery.isLoading}
			isError={fileQuery.isError}
			onBack={() => navigate({ to: "/media", search: { page: 1 } })}
			onOpenInOs={openInOs}
			onRename={
				taskId
					? undefined
					: (newName) => renameMutation.mutate({ projectId, oldName: fileName, newName })
			}
			onDelete={taskId ? undefined : () => deleteMutation.mutate({ projectId, name: fileName })}
			deleting={deleteMutation.isPending}
		/>
	);
}

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
});

export const Route = createFileRoute("/_app/media/$fileName/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: MediaFilePage,
});

function MediaFilePage() {
	const { fileName } = Route.useParams();
	const { projectId } = Route.useSearch();
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { projects } = useProjectFocus();

	const project = projects.find((candidate) => candidate.id === projectId) ?? null;

	const fileQuery = useQuery(
		orpc.media.readFile.queryOptions({ input: { projectId, name: fileName } }),
	);

	function invalidateMedia() {
		queryClient.invalidateQueries({
			predicate: (query) => Array.isArray(query.queryKey[0]) && query.queryKey[0][0] === "media",
		});
	}

	const deleteMutation = useMutation({
		...orpc.media.deleteFile.mutationOptions(),
		onSuccess: () => {
			invalidateMedia();
			toast.success("Arquivo deletado");
			navigate({ to: "/media" });
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

	const openInOs = project
		? () =>
				void openFolderInOs(joinPath(project.mainRoute, `.koworker/${MEDIAS_DIRNAME}/${fileName}`))
		: undefined;

	return (
		<AssetViewerPage
			name={fileName}
			blob={fileQuery.data}
			isLoading={fileQuery.isLoading}
			isError={fileQuery.isError}
			onBack={() => navigate({ to: "/media" })}
			onOpenInOs={openInOs}
			onRename={(newName) => renameMutation.mutate({ projectId, oldName: fileName, newName })}
			onDelete={() => deleteMutation.mutate({ projectId, name: fileName })}
			deleting={deleteMutation.isPending}
		/>
	);
}

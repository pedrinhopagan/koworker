import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { orpc } from "@/client";

type UseDeleteProjectProps = {
	projectId: string;
};

export function useDeleteProject({ projectId }: UseDeleteProjectProps) {
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const mutation = useMutation({
		...orpc.projects.remove.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: orpc.projects.list.queryOptions().queryKey });
			navigate({ to: "/projetos" });
		},
	});

	return {
		deleteProject: () => mutation.mutate({ id: projectId }),
		loading: mutation.isPending,
		error: mutation.isError,
		success: mutation.isSuccess,
	};
}

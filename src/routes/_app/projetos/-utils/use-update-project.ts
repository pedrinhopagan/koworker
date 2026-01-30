import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { ProjectCreateInput } from "@/api/schemas/projects";
import { orpc } from "@/client";

type UseUpdateProjectProps = {
	projectId: string;
};

export function useUpdateProject({ projectId }: UseUpdateProjectProps) {
	const queryClient = useQueryClient();

	const mutation = useMutation({
		...orpc.projects.update.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
		},
	});

	return {
		updateProject: (input: ProjectCreateInput) =>
			mutation.mutate({
				id: projectId,
				name: input.name,
				description: input.description,
				color: input.color,
				mainRoute: input.mainRoute,
			}),
		loading: mutation.isPending,
		error: mutation.isError,
		success: mutation.isSuccess,
	};
}

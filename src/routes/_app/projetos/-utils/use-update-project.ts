import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
			queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
			toast.success("Projeto atualizado.");
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
	};
}

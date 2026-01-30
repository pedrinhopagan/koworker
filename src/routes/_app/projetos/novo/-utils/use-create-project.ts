import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import type { ProjectCreateInput } from "@/api/schemas/projects";
import { orpc } from "@/client";

export function useCreateProject() {
	const navigate = useNavigate();
	const queryClient = useQueryClient();

	const mutation = useMutation({
		...orpc.projects.create.mutationOptions(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["projects"] });
			navigate({ to: "/projetos" });
		},
	});

	return {
		createProject: (input: ProjectCreateInput) => mutation.mutate(input),
		loading: mutation.isPending,
		error: mutation.isError,
	};
}

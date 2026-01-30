import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

import { orpc } from "@/client";

type CreateProjectInput = {
	name: string;
	description?: string;
	color?: string;
	mainRoute: string;
};

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
		createProject: (input: CreateProjectInput) => mutation.mutate(input),
		loading: mutation.isPending,
		error: mutation.isError,
	};
}

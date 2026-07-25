import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { orpc, reconnectRealtime } from "@/client";

export function useLogout() {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const { mutateAsync } = useMutation(orpc.auth.logout.mutationOptions());

	async function logout() {
		await mutateAsync({});

		queryClient.clear();
		reconnectRealtime();

		await navigate({ to: "/login" });
	}

	return { logout };
}

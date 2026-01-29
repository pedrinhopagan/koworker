import { useMutation } from "@tanstack/react-query";
import { orpc } from "@/client";

export function useLogout() {
	const { mutateAsync } = useMutation(orpc.auth.logout.mutationOptions());

	async function logout() {
		await mutateAsync({});
		window.location.href = "/login";
	}

	return { logout };
}

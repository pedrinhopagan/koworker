import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { orpc } from "@/client";
import { errorMessage } from "@/lib/orpc-errors";

export function useDevices() {
	const queryClient = useQueryClient();
	const query = useQuery(orpc.devices.list.queryOptions());
	const session = useQuery(orpc.auth.session.queryOptions());

	function invalidate() {
		queryClient.invalidateQueries({ queryKey: orpc.devices.list.key() });
	}

	function onError(error: Error) {
		toast.error(errorMessage(error, "Não foi possível alterar o dispositivo"));
	}

	const approve = useMutation({
		...orpc.devices.approve.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Dispositivo liberado");
		},
		onError,
	});

	const block = useMutation({
		...orpc.devices.block.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Dispositivo bloqueado");
		},
		onError,
	});

	const revoke = useMutation({
		...orpc.devices.revoke.mutationOptions(),
		onSuccess: () => {
			invalidate();
			toast.success("Dispositivo removido");
		},
		onError,
	});

	const rename = useMutation({
		...orpc.devices.rename.mutationOptions(),
		onSuccess: invalidate,
		onError,
	});

	return {
		devices: query.data ?? [],
		loading: query.isLoading,
		canManage: session.data?.canManageDevices ?? false,
		approve: (deviceId: string) => approve.mutate({ deviceId }),
		block: (deviceId: string) => block.mutate({ deviceId }),
		revoke: (deviceId: string) => revoke.mutate({ deviceId }),
		rename: (deviceId: string, name: string) => rename.mutate({ deviceId, name }),
		mutating: approve.isPending || block.isPending || revoke.isPending || rename.isPending,
	};
}

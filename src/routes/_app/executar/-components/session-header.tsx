import { useMutation } from "@tanstack/react-query";
import { Ban, Power, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { AGENT_PERMISSION_MODES, permissionModeLabel } from "@/constants/execution";
import { CODEX_APPROVAL_OPTIONS } from "@/constants/invoke";
import { errorMessage } from "@/lib/orpc-errors";
import type { RouterInputs } from "@/client";

type AgentSessionPermissionMode =
	RouterInputs["agentSessions"]["setPermissionMode"]["permissionMode"];

export function SessionHeaderActions({
	sessionId,
	cli,
	busy,
	permissionMode,
	onChanged,
}: {
	sessionId: string;
	cli: string;
	busy: boolean;
	permissionMode: string;
	onChanged: () => void;
}) {
	const interrupt = useMutation({
		...orpc.agentSessions.interrupt.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível interromper")),
	});
	const end = useMutation({
		...orpc.agentSessions.end.mutationOptions(),
		onSuccess: onChanged,
		onError: (error) => toast.error(errorMessage(error, "Não foi possível encerrar a sessão")),
	});
	const setMode = useMutation({
		...orpc.agentSessions.setPermissionMode.mutationOptions(),
		onSuccess: onChanged,
		onError: (error) => toast.error(errorMessage(error, "Não foi possível trocar o modo")),
	});

	// O codex não tem modo de permissão: o que ele aceita é a política de aprovação, que vale do
	// próximo turno em diante porque é fixada no spawn.
	const modeItems: { id: AgentSessionPermissionMode; label: string }[] =
		cli === "codex"
			? CODEX_APPROVAL_OPTIONS.map((option) => ({ id: option.value, label: option.label }))
			: AGENT_PERMISSION_MODES.map((mode) => ({ id: mode.id, label: mode.label }));

	return (
		<>
			<CustomSelect
				items={modeItems}
				value={permissionMode}
				onValueChange={(value) =>
					setMode.mutate({
						sessionId,
						permissionMode: value as AgentSessionPermissionMode,
					})
				}
				renderItem={(item) => item.label}
				renderTrigger={() => (
					<span className="flex items-center gap-2 text-xs">
						<ShieldCheck className="size-3.5 shrink-0" />
						{permissionModeLabel(permissionMode)}
					</span>
				)}
				disabled={setMode.isPending}
				size="sm"
				fitContent
			/>
			{busy && (
				<Button
					variant="outline"
					size="sm"
					disabled={interrupt.isPending}
					onClick={() => interrupt.mutate({ sessionId })}
				>
					<Ban className="size-4" />
					Interromper
				</Button>
			)}
			<Button
				variant="outline"
				size="sm"
				disabled={end.isPending}
				onClick={() => end.mutate({ sessionId })}
			>
				<Power className="size-4" />
				Encerrar
			</Button>
		</>
	);
}

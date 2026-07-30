import { CODEX_APPROVAL_OPTIONS } from "@/constants/invoke";

// Os modos que o `--permission-mode` do CLI aceita, com o nome que a sessão mostra.
export const AGENT_PERMISSION_MODES = [
	{ id: "acceptEdits", label: "Aceitar edições" },
	{ id: "default", label: "Perguntar" },
	{ id: "plan", label: "Só planejar" },
	{ id: "bypassPermissions", label: "Aceitar tudo" },
] as const;

// A sessão do codex guarda a política de aprovação nesta mesma coluna, então o rótulo procura nos
// dois conjuntos antes de cair no valor cru.
export function permissionModeLabel(mode: string) {
	return (
		AGENT_PERMISSION_MODES.find((item) => item.id === mode)?.label ??
		CODEX_APPROVAL_OPTIONS.find((item) => item.value === mode)?.label ??
		mode
	);
}

export const AGENT_SESSION_STATUS_LABELS = {
	live: "No ar",
	ended: "Encerrada",
	crashed: "Caiu",
} as const;

export const EXECUTION_STATUS_LABELS = {
	running: "Em execução",
	done: "Concluída",
	failed: "Falhou",
	timeout: "Tempo esgotado",
	cancelled: "Cancelada",
} as const;

import { Text } from "@/components/typography";

export type DocSaveStatus = "idle" | "saving" | "saved" | "error";

const SAVE_STATUS_LABEL: Record<DocSaveStatus, string> = {
	idle: "Sem alterações",
	saving: "Salvando…",
	saved: "Salvo",
	error: "Erro ao salvar",
};

export function SaveStatus({ status }: { status: DocSaveStatus }) {
	return (
		<Text
			as="span"
			size="xs"
			tone={status === "error" ? "destructive" : status === "saved" ? "success" : "muted"}
			data-slot="save-status"
			data-state={status}
			aria-live="polite"
		>
			{SAVE_STATUS_LABEL[status]}
		</Text>
	);
}

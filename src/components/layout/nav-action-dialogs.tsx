import { SweepInvocationsDialog } from "@/components/layout/sweep-invocations-dialog";
import { NewTaskDialog } from "@/components/prompt-bar/new-task-dialog";
import { NewVaultNoteDialog } from "@/components/prompt-bar/new-vault-note-dialog";
import { useNavActionDialogsStore } from "@/hooks/use-nav-action-dialogs";

/**
 * Montagem única dos diálogos de ação da navegação. Fica no AppShell para sobreviver ao unmount do
 * drawer mobile, que fecha (e desmonta) o Sheet ao disparar a ação.
 */
export function NavActionDialogs() {
	const openDialog = useNavActionDialogsStore((s) => s.openDialog);
	const close = useNavActionDialogsStore((s) => s.close);

	return (
		<>
			<NewVaultNoteDialog open={openDialog === "newVaultNote"} onClose={close} />
			<NewTaskDialog open={openDialog === "newTask"} onClose={close} />
			<SweepInvocationsDialog open={openDialog === "sweepInvocations"} onClose={close} />
		</>
	);
}

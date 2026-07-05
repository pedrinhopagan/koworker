import { FilePlus2 } from "lucide-react";
import { useState } from "react";

import { NewVaultNoteDialog } from "@/components/prompt-bar/new-vault-note-dialog";
import { Tooltip } from "@/components/ui/tooltip";

type NavActionButtonProps = {
	className?: string;
	iconSize?: number;
};

export function NewVaultNoteButton({ className, iconSize = 16 }: NavActionButtonProps) {
	const [open, setOpen] = useState(false);

	return (
		<>
			<Tooltip label="Nova nota no vault">
				<button
					type="button"
					onClick={() => setOpen(true)}
					className={className}
					aria-label="Nova nota no vault"
				>
					<FilePlus2 size={iconSize} />
				</button>
			</Tooltip>
			<NewVaultNoteDialog open={open} onClose={() => setOpen(false)} />
		</>
	);
}

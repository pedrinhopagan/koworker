import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type RenameDialogProps = {
	open: boolean;
	title: string;
	initial: string;
	pending: boolean;
	onClose: () => void;
	onSubmit: (label: string) => void;
};

export function RenameDialog({
	open,
	title,
	initial,
	pending,
	onClose,
	onSubmit,
}: RenameDialogProps) {
	const [draft, setDraft] = useState(initial);

	useEffect(() => {
		if (open) {
			setDraft(initial);
		}
	}, [open, initial]);

	function submit() {
		const label = draft.trim();

		if (label) {
			onSubmit(label);
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title={title}
			className="max-w-sm"
			footer={
				<div className="flex w-full justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onClose} disabled={pending}>
						Cancelar
					</Button>
					<Button size="sm" onClick={submit} disabled={pending || !draft.trim()}>
						Renomear
					</Button>
				</div>
			}
		>
			<Input
				autoFocus
				value={draft}
				onChange={(event) => setDraft(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") {
						submit();
					}
				}}
				disabled={pending}
			/>
		</Dialog>
	);
}

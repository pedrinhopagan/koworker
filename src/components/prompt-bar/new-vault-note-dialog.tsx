import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { usePromptBarStore } from "@/stores/prompt-bar";

type NewVaultNoteDialogProps = {
	open: boolean;
	onClose: () => void;
};

export function NewVaultNoteDialog({ open, onClose }: NewVaultNoteDialogProps) {
	const navigate = useNavigate();
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const text = usePromptBarStore((s) => s.text);
	const clear = usePromptBarStore((s) => s.clear);

	const [name, setName] = useState("nota.md");

	const writeMutation = useMutation(orpc.vault.writeFile.mutationOptions());

	async function handleCreate() {
		if (!selectedProjectId) return;
		const raw = name.trim();
		const fileName = raw.endsWith(".md") ? raw : `${raw}.md`;

		try {
			await writeMutation.mutateAsync({
				projectId: selectedProjectId,
				name: fileName,
				content: text,
			});
			clear();
			onClose();
			navigate({ to: "/vault/$fileName", params: { fileName } });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Não foi possível criar a nota");
		}
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Nova nota no vault"
			description={selectedProject ? `Projeto: ${selectedProject.name}` : undefined}
			className="max-w-md"
			footer={
				<div className="flex w-full justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onClose}>
						Cancelar
					</Button>
					<Button
						size="sm"
						onClick={() => void handleCreate()}
						disabled={!selectedProjectId || writeMutation.isPending}
					>
						Criar nota
					</Button>
				</div>
			}
		>
			{selectedProjectId ? (
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="nota.md"
					autoFocus
					onKeyDown={(event) => {
						if (event.key === "Enter") void handleCreate();
					}}
				/>
			) : (
				<p className="text-sm text-muted-foreground">
					Selecione um projeto em foco para criar uma nota no vault.
				</p>
			)}
		</Dialog>
	);
}

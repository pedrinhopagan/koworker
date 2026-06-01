import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";

import { orpc } from "@/client";
import {
	InlineTaskCreateForm,
	type InlineTaskCreateFormSubmitInput,
} from "@/components/tasks/InlineTaskCreateForm";
import { Text } from "@/components/typography";
import { Dialog } from "@/components/ui/dialog";
import { usePromptBarStore } from "@/stores/prompt-bar";

type NewTaskDialogProps = {
	open: boolean;
	onClose: () => void;
};

export function NewTaskDialog({ open, onClose }: NewTaskDialogProps) {
	const navigate = useNavigate();
	const text = usePromptBarStore((s) => s.text);
	const clear = usePromptBarStore((s) => s.clear);

	const createMutation = useMutation(orpc.tasks.create.mutationOptions());
	const writeFileMutation = useMutation(orpc.tasks.writeFile.mutationOptions());

	async function handleSubmit(data: InlineTaskCreateFormSubmitInput) {
		try {
			const task = await createMutation.mutateAsync({
				projectId: data.projectId,
				title: data.title,
				priorityId: data.priorityId,
				categoryId: data.categoryId,
			});
			if (!task) throw new Error("Não foi possível criar a tarefa");

			// O seed já gravou `# título` no index.md; com texto no prompt, reescreve o corpo abaixo do H1.
			const body = text.trim();
			if (body) {
				await writeFileMutation.mutateAsync({
					id: task.id,
					name: "index.md",
					content: `# ${data.title}\n\n${body}`,
				});
				clear();
			}

			onClose();
			navigate({ to: "/tarefas/$taskId", params: { taskId: task.id } });
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Não foi possível criar a tarefa");
		}
	}

	return (
		<Dialog open={open} onClose={onClose} title="Nova tarefa" className="max-w-md">
			{text.trim() ? (
				<Text size="xs" tone="muted" className="mb-3">
					O texto do prompt vira o corpo do <code>index.md</code> da tarefa.
				</Text>
			) : null}
			<InlineTaskCreateForm
				className="grid gap-3"
				forceProjectSelect
				resetMode="none"
				autoFocus
				loading={createMutation.isPending || writeFileMutation.isPending}
				onSubmit={(data) => void handleSubmit(data)}
			/>
		</Dialog>
	);
}

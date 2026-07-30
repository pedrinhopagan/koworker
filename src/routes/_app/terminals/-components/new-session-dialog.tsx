import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { INVOKE_CLI_OPTIONS, type InvokeCli } from "@/constants/invoke";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { errorMessage } from "@/lib/orpc-errors";

type NewSessionDialogProps = {
	open: boolean;
	onClose: () => void;
};

const CLI_ITEMS = INVOKE_CLI_OPTIONS.map((option) => ({
	id: option.value,
	label: option.label,
	hint: option.hint,
}));

export function NewSessionDialog({ open, onClose }: NewSessionDialogProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { projects, selectedProjectId, loading } = useProjectFocus();

	const [projectId, setProjectId] = useState<string | null>(null);
	const [cli, setCli] = useState<InvokeCli>("claude");
	const [label, setLabel] = useState("");
	const [prompt, setPrompt] = useState("");

	const activeProjectId = projectId ?? selectedProjectId ?? null;

	const start = useMutation({
		...orpc.kwTerminal.sessionStart.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível abrir a sessão")),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
			setLabel("");
			setPrompt("");
			onClose();
			navigate({ to: "/terminals/$paneId", params: { paneId: result.paneId } });
		},
	});

	function submit() {
		if (!activeProjectId) {
			return;
		}

		start.mutate({
			projectId: activeProjectId,
			cli,
			...(label.trim() ? { label: label.trim() } : {}),
			...(prompt.trim() ? { prompt: prompt.trim() } : {}),
		});
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Abrir nova sessão"
			description="Uma tab nova no kw-terminal, com o CLI já subindo na pasta do projeto"
			className="max-w-md"
			footer={
				<div className="flex w-full justify-end gap-2">
					<Button variant="outline" size="sm" onClick={onClose} disabled={start.isPending}>
						Cancelar
					</Button>
					<Button size="sm" onClick={submit} disabled={!activeProjectId || start.isPending}>
						Abrir sessão
					</Button>
				</div>
			}
		>
			<div className="flex flex-col gap-4">
				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Projeto
					</Text>
					<CustomSelect
						items={projects}
						value={activeProjectId ?? undefined}
						loading={loading}
						placeholder="Selecione o projeto"
						emptyMessage="Nenhum projeto cadastrado"
						onValueChange={(value) => setProjectId(value)}
						renderItem={(project) => <span className="truncate">{project.name}</span>}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						CLI
					</Text>
					<CustomSelect
						items={CLI_ITEMS}
						value={cli}
						onValueChange={(value) => setCli(value as InvokeCli)}
						renderItem={(item) => <span className="truncate">{item.label}</span>}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Nome da sessão (opcional)
					</Text>
					<Input
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder="investigacao"
						disabled={start.isPending}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Primeira mensagem (opcional)
					</Text>
					<Textarea
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="O que o agent deve fazer primeiro"
						disabled={start.isPending}
						className="min-h-24"
					/>
				</div>
			</div>
		</Dialog>
	);
}

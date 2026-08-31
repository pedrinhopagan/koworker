import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";

type NewShellDialogProps = {
	open: boolean;
	actions: TerminalWorkspaceActions;
	onClose: () => void;
};

export function NewShellDialog({ open, actions, onClose }: NewShellDialogProps) {
	const navigate = useNavigate();
	const { projects, selectedProjectId, loading } = useProjectFocus();

	const [projectId, setProjectId] = useState<string | null>(null);
	const [customPath, setCustomPath] = useState("");
	const [label, setLabel] = useState("");
	const [pending, setPending] = useState(false);

	const activeProjectId = projectId ?? selectedProjectId ?? null;
	const activeProject = projects.find((candidate) => candidate.id === activeProjectId) ?? null;
	// Caminho customizado vence quando preenchido; senão a pasta do projeto escolhido.
	const cwd = customPath.trim() || activeProject?.mainRoute || "";

	function submit() {
		if (!cwd) {
			return;
		}

		setPending(true);
		void actions
			.createShell({
				cwd,
				...(label.trim() ? { label: label.trim() } : {}),
				...(activeProjectId ? { projectId: activeProjectId } : {}),
				cols: 80,
				rows: 24,
			})
			.then((shell) => {
				setCustomPath("");
				setLabel("");
				onClose();
				return navigate({ to: "/shells", search: { tab: shell.id } });
			})
			.catch(() => {})
			.finally(() => setPending(false));
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Novo shell"
			description="Um PTY real dentro do Kowork, preso à pasta que você escolher"
			className="max-w-md bg-card text-card-foreground"
			footer={
				<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={pending}
						className="w-full sm:w-auto"
					>
						Cancelar
					</Button>
					<Button
						size="sm"
						onClick={submit}
						disabled={!cwd || pending}
						className="w-full sm:w-auto"
					>
						Abrir shell
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
						onValueChange={(value) => {
							setProjectId(value);
							setCustomPath("");
						}}
						renderItem={(project) => <span className="truncate">{project.name}</span>}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Ou uma pasta qualquer
					</Text>
					<Input
						value={customPath}
						onChange={(event) => setCustomPath(event.target.value)}
						placeholder="/caminho/absoluto/da/pasta"
						disabled={pending}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Nome (opcional)
					</Text>
					<Input
						value={label}
						onChange={(event) => setLabel(event.target.value)}
						placeholder="build, dev server, banco..."
						disabled={pending}
					/>
				</div>

				{cwd && (
					<Text size="xs" tone="muted">
						Vai nascer em <span className="font-mono">{cwd}</span>
					</Text>
				)}
			</div>
		</Dialog>
	);
}

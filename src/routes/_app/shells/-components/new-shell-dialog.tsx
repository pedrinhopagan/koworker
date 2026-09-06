import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useId, useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { TERMINAL_LABEL_MAX_LENGTH } from "@/api/schemas/terminal-workspace";
import type { TerminalWorkspaceActions } from "../-utils/use-terminal-workspace";

type NewShellDialogProps = {
	open: boolean;
	actions: TerminalWorkspaceActions;
	onClose: () => void;
};

export function NewShellDialog({ open, actions, onClose }: NewShellDialogProps) {
	const navigate = useNavigate();
	const formId = useId();
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
		if (!cwd || pending) {
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
			description="Abra um terminal na pasta do projeto ou em outra pasta."
			className="max-w-md bg-card text-card-foreground"
			footer={
				<div className="flex w-full flex-col-reverse gap-2 sm:flex-row sm:justify-end">
					<Button
						variant="outline"
						size="sm"
						onClick={onClose}
						disabled={pending}
						className="h-12 w-full sm:h-8 sm:w-auto"
					>
						Cancelar
					</Button>
					<Button
						size="sm"
						type="submit"
						form={formId}
						disabled={!cwd || pending}
						className="h-12 w-full sm:h-8 sm:w-auto"
					>
						{pending && <Loader2 className="size-4 animate-spin" />}
						{pending ? "Abrindo…" : "Abrir shell"}
					</Button>
				</div>
			}
		>
			<form
				id={formId}
				className="flex flex-col gap-4"
				onSubmit={(event) => {
					event.preventDefault();
					submit();
				}}
			>
				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Projeto
					</Text>
					<CustomSelect
						items={projects}
						value={activeProjectId ?? undefined}
						loading={loading}
						disabled={pending}
						ariaLabel="Projeto do shell"
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
						aria-label="Pasta do shell"
						autoCapitalize="none"
						spellCheck={false}
						className="max-lg:h-12 max-lg:text-[16px]"
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
						aria-label="Nome do shell"
						maxLength={TERMINAL_LABEL_MAX_LENGTH}
						className="max-lg:h-12 max-lg:text-[16px]"
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
			</form>
		</Dialog>
	);
}

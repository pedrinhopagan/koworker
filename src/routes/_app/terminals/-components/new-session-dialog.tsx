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
import {
	CODEX_APPROVAL_OPTIONS,
	CODEX_EFFORT_OPTIONS,
	CODEX_MODEL_OPTIONS,
	INVOKE_EFFORT_OPTIONS,
	INVOKE_CLI_OPTIONS,
	INVOKE_INHERIT,
	INVOKE_MODEL_OPTIONS,
	INVOKE_PERMISSION_OPTIONS,
	type CodexApprovalMode,
	type InvokeCli,
	type InvokePermissionMode,
	withoutInvokeInherit,
} from "@/constants/invoke";
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

const CLAUDE_PERMISSION_ITEMS = INVOKE_PERMISSION_OPTIONS.filter(
	(option) => option.value !== "bypass",
).map((option) => ({ id: option.value, label: option.label, hint: option.hint }));

const CODEX_APPROVAL_ITEMS = CODEX_APPROVAL_OPTIONS.filter(
	(option) => option.value !== "bypass",
).map((option) => ({ id: option.value, label: option.label, hint: option.hint }));

function selectItems(options: { value: string; label: string; hint: string }[]) {
	return options.map((option) => ({ id: option.value, label: option.label, hint: option.hint }));
}

export function NewSessionDialog({ open, onClose }: NewSessionDialogProps) {
	const navigate = useNavigate();
	const queryClient = useQueryClient();
	const { projects, selectedProjectId, loading } = useProjectFocus();

	const [projectId, setProjectId] = useState<string | null>(null);
	const [cli, setCli] = useState<InvokeCli>("claude");
	const [label, setLabel] = useState("");
	const [prompt, setPrompt] = useState("");
	const [model, setModel] = useState(INVOKE_INHERIT);
	const [effort, setEffort] = useState(INVOKE_INHERIT);
	const [agent, setAgent] = useState("");
	const [permissionMode, setPermissionMode] =
		useState<Exclude<InvokePermissionMode, "bypass">>("default");
	const [approvalMode, setApprovalMode] = useState<Exclude<CodexApprovalMode, "bypass">>("default");

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
	const resume = useMutation({
		...orpc.kwTerminal.sessionResumeLast.mutationOptions(),
		onError: (error) => toast.error(errorMessage(error, "Não foi possível retomar a conversa")),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({ queryKey: orpc.kwTerminal.overview.key() });
			onClose();
			await navigate({ to: "/terminals/$paneId", params: { paneId: result.paneId } });
		},
	});

	function submit() {
		if (!activeProjectId) {
			return;
		}
		const selectedModel = withoutInvokeInherit(model);
		const selectedEffort = withoutInvokeInherit(effort);

		start.mutate({
			projectId: activeProjectId,
			cli,
			tab: { kind: "session", ...(label.trim() ? { label: label.trim() } : {}) },
			...(prompt.trim() ? { prompt: prompt.trim() } : {}),
			...(selectedModel ? { model: selectedModel } : {}),
			...(selectedEffort ? { effort: selectedEffort } : {}),
			...(cli === "claude" && agent.trim() ? { agent: agent.trim() } : {}),
			...(cli === "claude" ? { permissionMode } : { approvalMode }),
		});
	}

	function resumeLast() {
		if (activeProjectId) {
			resume.mutate({ projectId: activeProjectId, cli });
		}
	}

	const pending = start.isPending || resume.isPending;
	const modelItems = selectItems(cli === "codex" ? CODEX_MODEL_OPTIONS : INVOKE_MODEL_OPTIONS);
	const effortItems = selectItems(cli === "codex" ? CODEX_EFFORT_OPTIONS : INVOKE_EFFORT_OPTIONS);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Abrir conversa"
			description="A conversa sempre nasce em um pane real do kw-terminal"
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
						variant="outline"
						size="sm"
						onClick={resumeLast}
						disabled={!activeProjectId || pending}
						className="w-full sm:w-auto"
					>
						Retomar última conversa
					</Button>
					<Button
						size="sm"
						onClick={submit}
						disabled={!activeProjectId || pending}
						className="w-full sm:w-auto"
					>
						Abrir nova conversa
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
						ariaLabel="Selecionar CLI"
						onValueChange={(value) => {
							setCli(value as InvokeCli);
							setModel(INVOKE_INHERIT);
							setEffort(INVOKE_INHERIT);
						}}
						renderItem={(item) => <span className="truncate">{item.label}</span>}
					/>
				</div>

				<div className="flex flex-col gap-1">
					<Text size="xs" tone="muted">
						Modelo
					</Text>
					<CustomSelect
						items={modelItems}
						value={model}
						ariaLabel="Selecionar modelo"
						onValueChange={setModel}
						renderItem={(item) => (
							<div className="min-w-0">
								<div className="truncate font-semibold">{item.label}</div>
								<div className="truncate text-xs text-muted-foreground">{item.hint}</div>
							</div>
						)}
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
						disabled={pending}
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
						disabled={pending}
						className="min-h-24"
					/>
				</div>

				<details className="border border-border bg-background/40">
					<summary className="min-h-11 cursor-pointer px-3 py-3 text-xs font-semibold text-foreground">
						Opções avançadas
					</summary>
					<div className="grid gap-3 border-t border-border p-3">
						<div className="flex flex-col gap-1">
							<Text size="xs" tone="muted">
								Esforço
							</Text>
							<CustomSelect
								items={effortItems}
								value={effort}
								ariaLabel="Selecionar esforço"
								onValueChange={setEffort}
								renderItem={(item) => (
									<div className="min-w-0">
										<div className="truncate font-semibold">{item.label}</div>
										<div className="truncate text-xs text-muted-foreground">{item.hint}</div>
									</div>
								)}
							/>
						</div>
						{cli === "claude" && (
							<>
								<Input
									value={agent}
									onChange={(event) => setAgent(event.target.value)}
									placeholder="Agent opcional"
									disabled={pending}
								/>
								<CustomSelect
									items={CLAUDE_PERMISSION_ITEMS}
									value={permissionMode}
									onValueChange={(value) =>
										setPermissionMode(value as Exclude<InvokePermissionMode, "bypass">)
									}
									renderItem={(item) => <span>{item.label}</span>}
								/>
							</>
						)}
						{cli === "codex" && (
							<CustomSelect
								items={CODEX_APPROVAL_ITEMS}
								value={approvalMode}
								onValueChange={(value) =>
									setApprovalMode(value as Exclude<CodexApprovalMode, "bypass">)
								}
								renderItem={(item) => <span>{item.label}</span>}
							/>
						)}
					</div>
				</details>
			</div>
		</Dialog>
	);
}

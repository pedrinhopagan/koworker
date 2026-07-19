import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Archive,
	CheckCircle2,
	ChevronDown,
	FolderSync,
	Loader2,
	RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc, type RouterOutputs } from "@/client";
import { SKILL_TOOL_LABEL } from "@/constants/skills";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";
import { Dialog } from "@/components/ui/dialog";
import { EmptyFeedback } from "@/components/ui/empty-feedback";

type SyncResult = RouterOutputs["skills"]["sync"];

type Choice = {
	sourcePath: string;
	hash: string;
};

export function SkillsSyncAction() {
	const queryClient = useQueryClient();
	const [open, setOpen] = useState(false);
	const [choices, setChoices] = useState<Record<string, Choice>>({});
	const [result, setResult] = useState<SyncResult | null>(null);
	const plan = useQuery({
		...orpc.skills.syncPlan.queryOptions(),
		enabled: open,
	});
	const mutation = useMutation({
		...orpc.skills.sync.mutationOptions(),
		onSuccess: async (data) => {
			setResult(data);
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: orpc.skills.list.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.skills.get.key() }),
				queryClient.invalidateQueries({ queryKey: orpc.skills.syncPlan.key() }),
			]);
			toast.success(`${data.created + data.updated} cópias sincronizadas entre as CLIs`);
		},
	});

	useEffect(() => {
		if (!plan.data) {
			setChoices({});
			return;
		}

		setChoices(
			Object.fromEntries(
				plan.data.skills
					.filter((skill) => skill.conflict)
					.map((skill) => {
						const preferred =
							skill.sources.find((source) => source.tool === "agents") ??
							skill.sources.reduce((latest, source) =>
								source.updatedAt > latest.updatedAt ? source : latest,
							);

						return [skill.slug, { sourcePath: preferred.path, hash: preferred.hash }];
					}),
			),
		);
	}, [plan.data]);

	const conflicts = plan.data?.skills.filter((skill) => skill.conflict) ?? [];
	const choicesComplete = conflicts.every((skill) => !!choices[skill.slug]);
	const pending = plan.data ? plan.data.totals.toCreate + plan.data.totals.toUpdate : 0;

	function handleOpen() {
		mutation.reset();
		setResult(null);
		setOpen(true);
	}

	function handleClose() {
		if (!mutation.isPending) {
			setOpen(false);
		}
	}

	function handleSync() {
		if (!plan.data) {
			return;
		}

		mutation.mutate({
			planHash: plan.data.planHash,
			choices: conflicts.map((skill) => ({ slug: skill.slug, ...choices[skill.slug] })),
		});
	}

	return (
		<>
			<Button type="button" variant="outline" size="sm" onClick={handleOpen}>
				<RefreshCw className="size-4" />
				Sync
			</Button>

			<Dialog
				open={open}
				onClose={handleClose}
				title="Sincronizar skills"
				description="Compartilha cada skill entre todas as CLIs"
				className="max-w-3xl"
				footer={
					result ? (
						<Button type="button" onClick={handleClose}>
							Fechar
						</Button>
					) : (
						<>
							<Button
								type="button"
								variant="ghost"
								disabled={mutation.isPending}
								onClick={handleClose}
							>
								Cancelar
							</Button>
							<Button
								type="button"
								disabled={
									mutation.isPending ||
									plan.isLoading ||
									!plan.data ||
									pending === 0 ||
									!choicesComplete
								}
								onClick={handleSync}
							>
								{mutation.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : (
									<FolderSync className="size-4" />
								)}
								{mutation.isPending ? "Sincronizando..." : "Criar backup e sincronizar"}
							</Button>
						</>
					)
				}
			>
				{plan.isLoading && (
					<div className="flex min-h-48 items-center justify-center gap-2 text-sm text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Comparando as pastas de skills...
					</div>
				)}

				{plan.isError && (
					<EmptyFeedback
						icon={FolderSync}
						title="Não foi possível analisar as skills"
						subtitle={
							plan.error instanceof Error ? plan.error.message : "Confira as fontes globais."
						}
					/>
				)}

				{result && (
					<div className="grid gap-4">
						<div className="flex items-start gap-3 border border-primary/30 bg-primary/5 p-4">
							<CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" />
							<div className="min-w-0">
								<Title as="h3" size="sm">
									Skills sincronizadas
								</Title>
								<Text size="sm" tone="muted" className="mt-1">
									{result.created} cópias criadas e {result.updated} atualizadas. Cada skill agora
									existe em todas as CLIs.
								</Text>
							</div>
						</div>
						{result.backupPath && (
							<div className="border border-border bg-muted/30 p-4">
								<div className="flex items-center gap-2">
									<Archive className="size-4 text-muted-foreground" />
									<Text size="xs" tone="muted" className="uppercase tracking-[0.12em]">
										Backup recuperável
									</Text>
								</div>
								<Text size="xs" className="mt-2 break-all font-mono">
									{result.backupPath}
								</Text>
							</div>
						)}
					</div>
				)}

				{plan.data && !result && (
					<div className="grid gap-5">
						<div className="grid gap-3 sm:grid-cols-4">
							<Summary label="Skills" value={plan.data.totals.skills} />
							<Summary label="Cópias a criar" value={plan.data.totals.toCreate} />
							<Summary label="Cópias a atualizar" value={plan.data.totals.toUpdate} />
							<Summary label="Conflitos" value={plan.data.totals.conflicts} warning />
						</div>

						<div className="grid gap-3 border border-border bg-muted/20 p-4">
							<PathInfo icon={Archive} label="Backups em" path={plan.data.backupRoot} />
						</div>

						{pending === 0 && (
							<EmptyFeedback
								icon={CheckCircle2}
								title="Tudo sincronizado"
								subtitle="Todas as skills já existem em todas as CLIs com o mesmo conteúdo."
							/>
						)}

						{conflicts.length > 0 && (
							<div className="grid gap-3">
								<div className="flex items-start gap-3 border border-amber-500/30 bg-amber-500/5 p-3">
									<AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
									<Text size="xs" tone="muted">
										Estas skills têm conteúdo diferente entre as CLIs. Escolha a versão que será
										replicada para todas; o conteúdo e os arquivos auxiliares selecionados serão
										mantidos.
									</Text>
								</div>

								{conflicts.map((skill) => {
									const selected = choices[skill.slug];
									const selectedSource = skill.sources.find(
										(source) => source.path === selected?.sourcePath,
									);

									return (
										<div key={skill.slug} className="grid gap-3 border border-border p-4">
											<div className="flex items-center justify-between gap-3">
												<Text size="sm" className="font-mono font-medium">
													/{skill.slug}
												</Text>
												<Text size="xs" tone="muted">
													{skill.sources.length} versões
												</Text>
											</div>
											<CustomSelect
												items={skill.sources.map((source) => ({ ...source, id: source.path }))}
												value={selected?.sourcePath ?? ""}
												onValueChange={(_, source) =>
													setChoices((current) => ({
														...current,
														[skill.slug]: { sourcePath: source.path, hash: source.hash },
													}))
												}
												placeholder="Escolha a versão que será mantida"
												renderTrigger={() => (
													<>
														<span className="min-w-0 flex-1 truncate text-left">
															{selectedSource
																? `${SKILL_TOOL_LABEL[selectedSource.tool]} · ${selectedSource.files} arquivos`
																: "Escolha a versão que será mantida"}
														</span>
														<ChevronDown className="size-4 opacity-50" />
													</>
												)}
												renderItem={(source) => (
													<div className="grid min-w-0 gap-0.5">
														<span className="font-medium text-foreground">
															{SKILL_TOOL_LABEL[source.tool]} · {source.files} arquivos
														</span>
														<span className="truncate font-mono text-[11px] opacity-70">
															{source.path}
														</span>
														{source.preview && (
															<span className="truncate text-[11px] opacity-70">
																{source.preview.split("\n").find((line) => !!line.trim())}
															</span>
														)}
													</div>
												)}
											/>
											{selectedSource && (
												<div className="grid gap-2 border border-border bg-muted/20 p-3">
													<Text size="xs" tone="muted" className="font-mono">
														{selectedSource.fileNames.slice(0, 6).join(" · ")}
														{selectedSource.fileNames.length > 6 &&
															` · +${selectedSource.fileNames.length - 6}`}
													</Text>
													{selectedSource.preview && (
														<Text
															size="xs"
															className="line-clamp-4 whitespace-pre-wrap font-mono leading-relaxed"
														>
															{selectedSource.preview}
														</Text>
													)}
												</div>
											)}
										</div>
									);
								})}
							</div>
						)}

						{mutation.isError && (
							<Text size="xs" tone="destructive">
								{mutation.error instanceof Error
									? mutation.error.message
									: "Não foi possível sincronizar as skills"}
							</Text>
						)}
					</div>
				)}
			</Dialog>
		</>
	);
}

function Summary({
	label,
	value,
	warning = false,
}: {
	label: string;
	value: number;
	warning?: boolean;
}) {
	return (
		<div className="border border-border bg-card p-3">
			<Text size="xs" tone="muted" className="uppercase tracking-[0.12em]">
				{label}
			</Text>
			<Text size="lg" className={warning && value > 0 ? "text-amber-500" : undefined}>
				{value}
			</Text>
		</div>
	);
}

function PathInfo({
	icon: Icon,
	label,
	path,
}: {
	icon: typeof Archive;
	label: string;
	path: string;
}) {
	return (
		<div className="flex min-w-0 items-start gap-3">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<div className="min-w-0">
				<Text size="xs" tone="muted" className="uppercase tracking-[0.12em]">
					{label}
				</Text>
				<Text size="xs" className="mt-1 break-all font-mono">
					{path}
				</Text>
			</div>
		</div>
	);
}

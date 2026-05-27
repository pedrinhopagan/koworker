import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ChevronLeft, FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { orpc } from "@/client";
import { MarkdownEditor } from "@/components/markdown-doc";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { useDebouncedWrite } from "@/hooks/use-debounced-write";
import { useProjectFocus } from "@/hooks/use-project-focus";

export function VaultPanel() {
	const { selectedProjectId, selectedProject } = useProjectFocus();
	const queryClient = useQueryClient();
	const navigate = useNavigate();

	const [activeName, setActiveName] = useState<string | null>(null);

	// Trocar de projeto fecha o arquivo aberto (ele não existe no vault do novo projeto).
	useEffect(() => {
		setActiveName(null);
	}, [selectedProjectId]);

	const projectId = selectedProjectId ?? "";
	const listQueryOptions = orpc.vault.list.queryOptions({ input: { projectId } });
	const vaultQuery = useQuery({ ...listQueryOptions, enabled: Boolean(selectedProjectId) });
	const files = vaultQuery.data ?? [];
	const current = files.find((file) => file.name === activeName) ?? null;

	const writeMutation = useMutation({
		...orpc.vault.writeFile.mutationOptions(),
		onSuccess: () => queryClient.invalidateQueries(listQueryOptions),
	});

	const { schedule, flush } = useDebouncedWrite((payload: { name: string; content: string }) =>
		writeMutation.mutateAsync({ projectId, ...payload }),
	);

	const promoteMutation = useMutation({
		...orpc.vault.promote.mutationOptions(),
		onSuccess: async (result) => {
			await queryClient.invalidateQueries({
				predicate: (query) =>
					Array.isArray(query.queryKey[0]) &&
					(query.queryKey[0][0] === "tasks" || query.queryKey[0][0] === "vault"),
			});
			toast.success("Nota promovida a tarefa");
			navigate({ to: "/tarefas/$taskId", params: { taskId: result.id } });
		},
		onError: () => toast.error("Não foi possível promover a nota"),
	});

	if (!selectedProjectId) {
		return (
			<Text size="sm" tone="muted">
				Selecione um projeto para ver o vault.
			</Text>
		);
	}

	if (vaultQuery.isLoading) {
		return (
			<div className="flex items-center gap-2 text-muted-foreground">
				<Loader2 size={16} className="animate-spin" />
				<Text size="sm" tone="muted">
					Carregando vault...
				</Text>
			</div>
		);
	}

	if (current) {
		return (
			<div className="flex h-full flex-col gap-4">
				<div className="flex items-center justify-between gap-3">
					<Button
						variant="ghost"
						size="sm"
						onClick={async () => {
							await flush();
							setActiveName(null);
						}}
					>
						<ChevronLeft size={14} />
						Vault
					</Button>
					<Button
						size="sm"
						onClick={async () => {
							await flush();
							promoteMutation.mutate({ projectId, name: current.name });
						}}
						disabled={promoteMutation.isPending}
					>
						<ArrowUpRight size={14} />
						Promover a tarefa
					</Button>
				</div>

				<MarkdownEditor
					key={current.name}
					initialContent={current.content}
					onChange={(content) => schedule({ name: current.name, content })}
				/>
			</div>
		);
	}

	if (files.length === 0) {
		return (
			<Text size="sm" tone="muted">
				Nenhuma nota solta em <code>.koworker/</code> de {selectedProject?.name ?? "este projeto"}.
			</Text>
		);
	}

	return (
		<div className="flex flex-col gap-1">
			{files.map((file) => (
				<button
					key={file.name}
					type="button"
					onClick={() => setActiveName(file.name)}
					className="flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary/50"
				>
					<FileText size={16} className="shrink-0 text-muted-foreground" />
					<span className="min-w-0 flex-1">
						<span className="block truncate text-sm text-foreground">{file.title}</span>
						<span className="block truncate text-xs text-muted-foreground">{file.name}</span>
					</span>
				</button>
			))}
		</div>
	);
}

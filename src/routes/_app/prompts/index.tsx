import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import { orpc, type RouterOutputs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Pagination } from "@/components/ui/pagination";
import { copyToClipboard } from "@/lib/build-prompt";
import { PromptHistoryFilters } from "./-components/prompt-history-filters";
import {
	PromptHistoryFormDialog,
	type PromptHistoryFormValues,
} from "./-components/prompt-history-form-dialog";
import { PromptHistoryList } from "./-components/prompt-history-list";
import type { PromptHistoryKind } from "./-components/prompt-history-kind";

const PAGE_SIZE = 12;

const searchSchema = z.object({
	q: z.string().optional(),
	kind: z.enum(["copy", "agent", "skill"]).optional(),
	projectId: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
});

type PromptHistoryItem = RouterOutputs["promptHistory"]["list"]["items"][number];

export const Route = createFileRoute("/_app/prompts/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: PromptsPage,
});

function optionalValue(value: string) {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

function PromptsPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();
	const queryClient = useQueryClient();
	const [editingItem, setEditingItem] = useState<PromptHistoryItem | null>(null);
	const [formOpen, setFormOpen] = useState(false);

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const selectedProject = (projectsQuery.data ?? []).find(
		(project) => project.id === search.projectId,
	);

	const listQuery = useQuery(
		orpc.promptHistory.list.queryOptions({
			input: {
				page: search.page,
				pageSize: PAGE_SIZE,
				q: search.q,
				kind: search.kind,
				projectId: search.projectId,
			},
		}),
	);

	const invalidatePromptHistory = () =>
		queryClient.invalidateQueries({ queryKey: orpc.promptHistory.list.key() });

	const createMutation = useMutation({
		...orpc.promptHistory.create.mutationOptions(),
		onSuccess: async () => {
			await invalidatePromptHistory();
			setFormOpen(false);
			setEditingItem(null);
			toast.success("Prompt criado");
		},
		onError: (error: Error) => toast.error(`Erro ao criar prompt: ${error.message}`),
	});

	const updateMutation = useMutation({
		...orpc.promptHistory.update.mutationOptions(),
		onSuccess: async () => {
			await invalidatePromptHistory();
			setFormOpen(false);
			setEditingItem(null);
			toast.success("Prompt atualizado");
		},
		onError: (error: Error) => toast.error(`Erro ao editar prompt: ${error.message}`),
	});

	function updateSearch(next: {
		q?: string;
		kind?: PromptHistoryKind;
		projectId?: string;
		page?: number;
	}) {
		navigate({
			search: (prev) => ({
				...prev,
				...next,
				page: next.page ?? 1,
			}),
			replace: true,
		});
	}

	function handleNew() {
		setEditingItem(null);
		setFormOpen(true);
	}

	function handleEdit(item: PromptHistoryItem) {
		setEditingItem(item);
		setFormOpen(true);
	}

	async function handleCopy(item: PromptHistoryItem) {
		const ok = await copyToClipboard(item.prompt);
		toast[ok ? "success" : "error"](ok ? "Prompt copiado" : "Falha ao copiar prompt");
	}

	function handleSubmit(values: PromptHistoryFormValues) {
		if (editingItem) {
			updateMutation.mutate({
				id: editingItem.id,
				kind: values.kind,
				text: values.text,
				prompt: values.prompt,
				target: values.target,
				projectId: editingItem.projectId,
				projectName: values.projectName,
				routePath: values.routePath,
				agentSlug: values.agentSlug,
				skillSlug: values.skillSlug,
				model: values.model,
				effort: values.effort,
			});
			return;
		}

		createMutation.mutate({
			kind: values.kind,
			text: values.text,
			prompt: values.prompt,
			target: optionalValue(values.target),
			projectId: search.projectId,
			projectName: optionalValue(values.projectName) ?? selectedProject?.name,
			routePath: optionalValue(values.routePath),
			agentSlug: optionalValue(values.agentSlug),
			skillSlug: optionalValue(values.skillSlug),
			model: optionalValue(values.model),
			effort: optionalValue(values.effort),
		});
	}

	const data = listQuery.data;
	const total = data?.total ?? 0;
	const totalPages = data?.totalPages ?? 1;
	const loading = listQuery.isLoading || projectsQuery.isLoading;

	return (
		<PageShell
			title="Histórico de prompts"
			description={`${total} ${total === 1 ? "prompt registrado" : "prompts registrados"}`}
			icon={History}
			contentClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4"
		>
			<PromptHistoryFilters
				q={search.q ?? ""}
				kind={search.kind}
				projectId={search.projectId}
				projects={projectsQuery.data ?? []}
				onChange={updateSearch}
				onNew={handleNew}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
				<PromptHistoryList
					items={data?.items ?? []}
					loading={loading}
					onCopy={(item) => void handleCopy(item)}
					onEdit={handleEdit}
				/>
			</div>

			<Pagination
				page={search.page}
				totalPages={totalPages}
				total={total}
				onPageChange={(page) => updateSearch({ page })}
				singularLabel="prompt"
				pluralLabel="prompts"
				className="shrink-0"
			/>

			<PromptHistoryFormDialog
				open={formOpen}
				item={editingItem}
				loading={createMutation.isPending || updateMutation.isPending}
				onClose={() => setFormOpen(false)}
				onSubmit={handleSubmit}
			/>
		</PageShell>
	);
}

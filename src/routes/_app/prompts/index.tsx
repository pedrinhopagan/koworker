import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { PromptSourceSchema, type PromptSource } from "@/api/schemas/prompt-history";
import { orpc, type RouterOutputs } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Pagination } from "@/components/ui/pagination";
import { copyToClipboard } from "@/lib/build-prompt";
import { PromptHistoryFilters } from "./-components/prompt-history-filters";
import { PromptHistoryList } from "./-components/prompt-history-list";

const PAGE_SIZE = 12;

const searchSchema = z.object({
	q: z.string().optional(),
	source: PromptSourceSchema.optional(),
	projectId: z.string().optional(),
	page: z.coerce.number().int().min(1).optional().default(1),
});

type PromptHistoryItem = RouterOutputs["promptHistory"]["list"]["items"][number];

export const Route = createFileRoute("/_app/prompts/")({
	validateSearch: (search) => searchSchema.parse(search),
	component: PromptsPage,
});

function PromptsPage() {
	const search = Route.useSearch();
	const navigate = Route.useNavigate();

	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const listQuery = useQuery({
		...orpc.promptHistory.list.queryOptions({
			input: {
				page: search.page,
				pageSize: PAGE_SIZE,
				q: search.q,
				source: search.source,
				projectId: search.projectId,
			},
		}),
		placeholderData: (previous) => previous,
	});

	function updateSearch(next: {
		q?: string;
		source?: PromptSource;
		projectId?: string;
		page?: number;
	}) {
		navigate({
			search: (prev) => ({ ...prev, ...next, page: next.page ?? 1 }),
			replace: true,
		});
	}

	async function handleCopy(item: PromptHistoryItem) {
		const ok = await copyToClipboard(item.prompt);
		toast[ok ? "success" : "error"](ok ? "Prompt copiado" : "Falha ao copiar prompt");
	}

	const data = listQuery.data;
	const total = data?.total ?? 0;

	return (
		<PageShell
			title="Histórico de prompts"
			description="Tudo que você mandou pelo Claude, pelo Codex ou copiou da barra, sem repetição"
			icon={History}
			contentClassName="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pb-4"
		>
			<PromptHistoryFilters
				q={search.q ?? ""}
				source={search.source}
				projectId={search.projectId}
				projects={projectsQuery.data ?? []}
				onChange={updateSearch}
			/>

			<div className="min-h-0 flex-1 overflow-y-auto pr-1 pb-3">
				<PromptHistoryList
					items={data?.items ?? []}
					loading={listQuery.isLoading}
					onCopy={(item) => void handleCopy(item)}
				/>
			</div>

			<Pagination
				page={search.page}
				totalPages={data?.totalPages ?? 1}
				total={total}
				onPageChange={(page) => updateSearch({ page })}
				singularLabel="prompt"
				pluralLabel="prompts"
				className="shrink-0"
			/>
		</PageShell>
	);
}

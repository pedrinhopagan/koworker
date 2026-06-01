import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/tarefas/$taskId/")({
	beforeLoad: async ({ context, params }) => {
		const task = await context.queryClient.ensureQueryData(
			orpc.tasks.getFull.queryOptions({ input: { id: params.taskId } }),
		);
		if (!task) {
			return;
		}
		// Reabrir a tarefa cai sempre num arquivo concreto na URL (paridade com vault/docs/skill).
		// `primaryFile` pode apontar pra um arquivo já apagado — só redireciona pra um que existe.
		const target = task.files.find((f) => f.name === task.primaryFile)?.name ?? task.files[0]?.name;
		if (!target) {
			return;
		}
		throw redirect({
			to: "/tarefas/$taskId/$file",
			params: { taskId: params.taskId, file: target },
			replace: true,
		});
	},
	component: TaskEmptyPage,
});

// Só renderiza quando o `beforeLoad` não redirecionou: tarefa inexistente ou sem nenhum arquivo.
function TaskEmptyPage() {
	const { taskId } = Route.useParams();
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const [newFileValue, setNewFileValue] = useState("");

	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));
	const task = taskQuery.data ?? null;

	const writeFileMutation = useMutation({
		...orpc.tasks.writeFile.mutationOptions(),
		onSuccess: async (_result, variables) => {
			await queryClient.invalidateQueries(
				orpc.tasks.getFull.queryOptions({ input: { id: taskId } }),
			);
			navigate({
				to: "/tarefas/$taskId/$file",
				params: { taskId, file: variables.name },
				replace: true,
			});
		},
	});

	if (taskQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando tarefa...
					</Text>
				</div>
			</div>
		);
	}

	if (!task) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Tarefa não encontrada.
				</Text>
				<Button variant="outline" asChild>
					<Link to="/tarefas">Voltar para tarefas</Link>
				</Button>
			</div>
		);
	}

	const createFile = () => {
		const raw = newFileValue.trim();
		if (!raw) {
			return;
		}
		const name = raw.endsWith(".md") ? raw : `${raw}.md`;
		writeFileMutation.mutate({ id: taskId, name, content: "" });
	};

	return (
		<div className="flex h-full flex-col items-center justify-center gap-4">
			<Text size="sm" tone="muted">
				Nenhum arquivo markdown nesta tarefa.
			</Text>
			<div className="flex w-full max-w-xs items-center gap-2">
				<input
					autoFocus
					value={newFileValue}
					onChange={(e) => setNewFileValue(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter") createFile();
					}}
					placeholder="index.md"
					className="h-9 min-w-0 flex-1 rounded-md border border-border bg-transparent px-3 text-sm outline-none placeholder:text-muted-foreground focus:border-ring"
				/>
				<Button size="sm" onClick={createFile} disabled={writeFileMutation.isPending}>
					{writeFileMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : "Criar"}
				</Button>
			</div>
		</div>
	);
}

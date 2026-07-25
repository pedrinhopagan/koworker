import { useQuery } from "@tanstack/react-query";
import { createLazyFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { orpc } from "@/client";
import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { canonicalTaskRoute, taskMatchesFeature } from "../../-utils/task-route-resolution";
import { TaskFilePage } from "../$file.lazy";

export const Route = createLazyFileRoute("/_app/tarefas/$taskId/$file_/$canonicalFile")({
	component: CanonicalTaskFileRoute,
});

function CanonicalTaskFileRoute() {
	const { taskId: featureId, file: taskId, canonicalFile } = Route.useParams();
	const { projectId } = Route.useSearch();
	const taskQuery = useQuery(orpc.tasks.getFull.queryOptions({ input: { id: taskId } }));

	if (taskQuery.isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader2 className="size-5 animate-spin text-muted-foreground" />
			</div>
		);
	}
	if (!taskQuery.data) {
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
	if (!taskMatchesFeature(taskQuery.data, { featureId, projectId })) {
		const canonical = canonicalTaskRoute(taskQuery.data);
		return (
			<Navigate
				to="/tarefas/$taskId/$file/$canonicalFile"
				params={{
					taskId: canonical.featureId,
					file: canonical.taskId,
					canonicalFile,
				}}
				replace
			/>
		);
	}

	return <TaskFilePage taskId={taskId} activeFile={canonicalFile} />;
}

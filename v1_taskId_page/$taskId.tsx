import { MainLayout } from "@/components/layouts/MainLayout";
import { createFileRoute } from "@tanstack/react-router";
import { taskDetailSearchSchema } from "../../lib/searchSchemas";
import { ManageTaskRoot } from "./$taskId/-components";

function TaskDetailPage() {
	const { taskId } = Route.useParams();
	return (
		<MainLayout>
			<ManageTaskRoot taskId={taskId} />
		</MainLayout>
	);
}

export const Route = createFileRoute("/tasks/$taskId")({
	component: TaskDetailPage,
	validateSearch: (search) => taskDetailSearchSchema.parse(search),
});

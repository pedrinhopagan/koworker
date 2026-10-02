import {
	type LinkProps,
	type RegisteredRouter,
	useNavigate,
	useRouterState,
} from "@tanstack/react-router";

import { ProjectPickerDialog } from "@/components/projects/project-picker-dialog";
import { useProjectFocus } from "@/hooks";
import { useProjectSelectDialog } from "@/hooks/use-project-select-dialog";
import { toast } from "@/components/ui/toast";
import { ALL_PROJECTS_ID, DISABLED_PATHS } from "@/lib/project-focus";

type ProjectSelectDialogProps = {
	open: boolean;
	onClose: () => void;
};

export function GlobalProjectSelectDialog() {
	const { open, closeDialog } = useProjectSelectDialog();
	return <ProjectSelectDialog open={open} onClose={closeDialog} />;
}

export function ProjectSelectDialog({ open, onClose }: ProjectSelectDialogProps) {
	const routerState = useRouterState();
	const navigate = useNavigate();
	const { projects, selectedProjectId, loading, setSelectedProjectId } = useProjectFocus();

	const currentMatch = routerState.matches.at(-1);
	const currentRoutePath = (currentMatch?.fullPath ?? "/").replace(
		/\/$/,
		"",
	) as LinkProps<RegisteredRouter>["to"];
	const disableChangeFocus = DISABLED_PATHS.has(currentRoutePath);
	const focusedProjectValue = selectedProjectId === undefined ? ALL_PROJECTS_ID : selectedProjectId;

	async function handleSelect(id: string) {
		if (disableChangeFocus) {
			return;
		}

		onClose();

		if (id === focusedProjectValue) {
			return;
		}

		const projectId = id === ALL_PROJECTS_ID ? undefined : id;

		if (currentRoutePath === "/tarefas") {
			await navigate({
				to: "/tarefas",
				search: (previous) => ({ ...previous, projectId }),
				replace: true,
			});
		} else if (currentRoutePath === "/projetos") {
			await navigate({
				to: "/projetos",
				search: (previous) => ({ ...previous, projetoId: projectId }),
				replace: true,
			});
		} else if (currentRoutePath?.includes("$") || currentRoutePath === "/arquivo") {
			await navigate({ to: "/", search: {} });
		}

		setSelectedProjectId(projectId);
	}

	return (
		<ProjectPickerDialog
			open={open}
			onClose={onClose}
			projects={projects.map((project) => ({
				id: project.id,
				name: project.name,
				color: project.color,
				displayPath: project.displayPath,
			}))}
			value={focusedProjectValue ?? undefined}
			onSelect={(id) => {
				void handleSelect(id).catch(() => toast.error("Não foi possível trocar o projeto"));
			}}
			loading={loading}
			disabled={disableChangeFocus}
			allOption={{
				id: ALL_PROJECTS_ID,
				name: "Todos os projetos",
				color: null,
				displayPath: "Visão combinada das tarefas",
			}}
		/>
	);
}

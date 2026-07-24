import {
	type LinkProps,
	type RegisteredRouter,
	useNavigate,
	useParams,
	useRouterState,
} from "@tanstack/react-router";

import { ProjectPickerDialog } from "@/components/projects/project-picker-dialog";
import { useProjectFocus } from "@/hooks";
import { useProjectSelectDialog } from "@/hooks/use-project-select-dialog";
import { ALL_PROJECTS_ID, DISABLED_PATHS, REDIRECT_ON_SELECT_PATHS } from "@/lib/project-focus";

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
	const params = useParams({ strict: false });
	const { projects, selectedProjectId, loading, setSelectedProjectId } = useProjectFocus();

	const currentMatch = routerState.matches.at(-1);
	const currentRoutePath = (currentMatch?.fullPath ?? "/").replace(
		/\/$/,
		"",
	) as LinkProps<RegisteredRouter>["to"];
	const disableChangeFocus = DISABLED_PATHS.has(currentRoutePath);
	const redirectOnSelect = REDIRECT_ON_SELECT_PATHS.get(currentRoutePath);
	const focusedProjectValue = selectedProjectId === undefined ? ALL_PROJECTS_ID : selectedProjectId;
	const currentValue =
		currentRoutePath === "/projetos/$projetoId" ? params.projetoId : focusedProjectValue;

	function handleSelect(id: string) {
		if (disableChangeFocus) {
			return;
		}

		if (id === ALL_PROJECTS_ID) {
			setSelectedProjectId(undefined);

			if (currentRoutePath === "/projetos/$projetoId") {
				navigate({ to: "/projetos" });
				onClose();
				return;
			}
		} else {
			setSelectedProjectId(id);

			if (currentRoutePath === "/projetos/$projetoId") {
				navigate({ to: "/projetos/$projetoId", params: { projetoId: id } });
				onClose();
				return;
			}
		}

		if (redirectOnSelect) {
			navigate({ to: redirectOnSelect });
		}

		onClose();
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
			value={currentValue ?? undefined}
			onSelect={handleSelect}
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

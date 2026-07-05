import { type LinkProps, type RegisteredRouter, useRouterState } from "@tanstack/react-router";
import { CheckCheckIcon, FolderKanbanIcon } from "lucide-react";
import { useMemo } from "react";

import { Dialog } from "@/components/ui/dialog";
import { Text } from "@/components/typography";
import { useProjectFocus } from "@/hooks";
import { ALL_PROJECTS_ID, DISABLED_PATHS } from "@/lib/project-focus";
import { cn } from "@/lib/utils";

type ProjectItem = {
	id: string;
	name: string;
	color: string | null;
};

type ProjectSelectDialogProps = {
	open: boolean;
	onClose: () => void;
};

export function ProjectSelectDialog({ open, onClose }: ProjectSelectDialogProps) {
	const routerState = useRouterState();
	const { projects, selectedProjectId, loading, setSelectedProjectId } = useProjectFocus();

	const projectItems = useMemo<ProjectItem[]>(() => {
		return [
			{ id: ALL_PROJECTS_ID, name: "Todos os projetos", color: null },
			...projects.map((project) => ({
				id: project.id,
				name: project.name,
				color: project.color ?? null,
			})),
		];
	}, [projects]);

	const currentRoutePath = (routerState.matches.at(-1)?.fullPath ?? "/").replace(/\/$/, "");
	const disableChangeFocus = DISABLED_PATHS.has(
		currentRoutePath as LinkProps<RegisteredRouter>["to"],
	);
	const isEmpty = projectItems.length <= 1;

	const currentValue =
		selectedProjectId === undefined ? ALL_PROJECTS_ID : (selectedProjectId ?? undefined);

	function handleSelect(id: string) {
		if (disableChangeFocus || isEmpty) {
			return;
		}

		if (id === ALL_PROJECTS_ID) {
			setSelectedProjectId(undefined);
		} else {
			setSelectedProjectId(id);
		}
		onClose();
	}

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Selecionar projeto"
			description={
				disableChangeFocus
					? "Troca de projeto indisponível nesta página."
					: "Alt+P para abrir este diálogo."
			}
			className="max-w-md"
		>
			{loading ? (
				<Text size="sm" tone="muted">
					Carregando projetos...
				</Text>
			) : isEmpty ? (
				<Text size="sm" tone="muted">
					Nenhum projeto cadastrado.
				</Text>
			) : (
				<ul className="-mx-1 flex flex-col gap-0.5">
					{projectItems.map((project) => {
						const isSelected = project.id === currentValue;

						return (
							<li key={project.id}>
								<button
									type="button"
									disabled={disableChangeFocus}
									onClick={() => handleSelect(project.id)}
									className={cn(
										"flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left transition-colors",
										isSelected && "bg-muted/50 font-medium",
										!disableChangeFocus && "hover:bg-muted/30",
										disableChangeFocus && "cursor-not-allowed opacity-60",
									)}
									style={isSelected ? { color: project.color ?? undefined } : undefined}
								>
									{project.color ? (
										<span
											className="size-2.5 shrink-0"
											style={{ backgroundColor: project.color }}
										/>
									) : (
										<FolderKanbanIcon className="size-3.5 shrink-0 text-current" />
									)}
									<span className="min-w-0 flex-1 truncate text-sm">{project.name}</span>
									{isSelected ? (
										<CheckCheckIcon
											className="size-4 shrink-0"
											style={{ color: project.color ?? undefined }}
										/>
									) : null}
								</button>
							</li>
						);
					})}
				</ul>
			)}
		</Dialog>
	);
}

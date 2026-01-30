/**
 * ProjectFocusBar - Project focus selector
 * Provides a dropdown to select the active project with accent color highlight
 */

import { useQuery } from "@tanstack/react-query";
import { CheckCheckIcon, ChevronDownIcon, FolderKanbanIcon } from "lucide-react";
import { useMemo } from "react";

import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useSelectedProjectStore } from "@/stores/selected-project";

type ProjectItem = {
	id: string;
	name: string;
	color: string | null;
};

const ALL_PROJECTS_ID = "__all__";

export function ProjectFocusBar() {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projects = projectsQuery.data ?? [];

	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);
	const setSelectedProjectId = useSelectedProjectStore((s) => s.setSelectedProjectId);

	// Build items list with "All projects" option
	const projectItems = useMemo<ProjectItem[]>(() => {
		const items: ProjectItem[] = projects.map((project) => ({
			id: project.id,
			name: project.name,
			color: project.color ?? null,
		}));
		return [{ id: ALL_PROJECTS_ID, name: "Todos os projetos", color: null }, ...items];
	}, [projects]);

	// Get selected project info
	const selectedProject = useMemo(() => {
		return projects.find((project) => project.id === selectedProjectId);
	}, [projects, selectedProjectId]);

	const accentColor = selectedProject?.color ?? null;

	function handleValueChange(id: string) {
		setSelectedProjectId(id === ALL_PROJECTS_ID ? null : id);
	}

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
				Projeto
			</span>

			<CustomSelect
				items={projectItems}
				value={selectedProjectId ?? ALL_PROJECTS_ID}
				onValueChange={handleValueChange}
				variant="minimal"
				triggerClassName={cn(
					"flex items-center gap-3 px-4 py-2 rounded-lg min-w-[200px] transition-all duration-200 border-2",
					accentColor ? "shadow-sm hover:shadow-md" : "bg-card border-border",
				)}
				triggerStyle={
					accentColor
						? {
								background: `linear-gradient(135deg, ${accentColor}15 0%, ${accentColor}08 100%)`,
								borderColor: `${accentColor}50`,
							}
						: undefined
				}
				contentClassName="min-w-[220px]"
				renderTrigger={() => (
					<>
						{accentColor ? (
							<span
								className="size-3 rounded-full shrink-0"
								style={{
									backgroundColor: accentColor,
									boxShadow: `0 0 0 2px ${accentColor}40, 0 0 0 4px ${accentColor}15`,
								}}
							/>
						) : (
							<FolderKanbanIcon className="size-4 text-muted-foreground shrink-0" />
						)}
						<span
							className={cn(
								"flex-1 text-sm font-medium truncate text-left",
								accentColor ? "text-foreground" : "text-foreground",
							)}
						>
							{selectedProject?.name ?? "Todos os projetos"}
						</span>
						<ChevronDownIcon
							className={cn(
								"size-4 shrink-0 transition-colors",
								accentColor ? "text-foreground" : "text-muted-foreground",
							)}
						/>
					</>
				)}
				renderItem={(project, isSelected) => (
					<div
						className={cn(
							"flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors",
							isSelected ? "bg-muted" : "hover:bg-muted/50",
						)}
					>
						{project.color ? (
							<span
								className="size-2.5 rounded-full shrink-0"
								style={{ backgroundColor: project.color }}
							/>
						) : (
							<FolderKanbanIcon className="size-3.5 text-muted-foreground shrink-0" />
						)}
						<span
							className={cn(
								"flex-1 text-sm truncate",
								isSelected ? "font-medium text-foreground" : "text-foreground",
							)}
						>
							{project.name}
						</span>
						{isSelected && (
							<CheckCheckIcon
								className="size-4 shrink-0"
								style={{ color: project.color ?? undefined }}
							/>
						)}
					</div>
				)}
			/>
		</div>
	);
}

/**
 * AccentStripe - Vertical accent stripe that reflects the selected project color
 * Shows a gradient stripe on the left edge based on selected project
 */
export function AccentStripe() {
	const projectsQuery = useQuery(orpc.projects.list.queryOptions());
	const projects = projectsQuery.data ?? [];

	const selectedProjectId = useSelectedProjectStore((s) => s.selectedProjectId);

	const accentColor = useMemo(() => {
		const selectedProject = projects.find((project) => project.id === selectedProjectId);
		return selectedProject?.color ?? null;
	}, [projects, selectedProjectId]);

	if (!accentColor) {
		return null;
	}

	return (
		<div
			className="w-0.5 shrink-0 self-stretch"
			style={{
				background: `linear-gradient(to bottom, ${accentColor} 0%, ${accentColor}60 50%, ${accentColor}30 100%)`,
			}}
		/>
	);
}

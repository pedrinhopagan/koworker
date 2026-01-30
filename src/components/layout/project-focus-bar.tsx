import { CheckCheckIcon, ChevronDownIcon, FolderKanbanIcon } from "lucide-react";
import { useMemo } from "react";

import { CustomSelect } from "@/components/ui/custom-select";
import { useProjectFocus } from "@/hooks";
import { cn } from "@/lib/utils";

type ProjectItem = {
	id: string;
	name: string;
	color: string | null;
};

export function ProjectFocusBar() {
	const { projects, selectedProjectId, selectedProject, accent, loading, setSelectedProjectId } =
		useProjectFocus();

	const projectItems = useMemo<ProjectItem[]>(() => {
		return projects.map((project) => ({
			id: project.id,
			name: project.name,
			color: project.color ?? null,
		}));
	}, [projects]);

	const accentColor = accent?.color ?? null;
	const isEmpty = projectItems.length === 0;
	const label =
		selectedProject?.name ??
		(loading ? "Carregando projetos..." : isEmpty ? "Nenhum projeto" : "Selecione um projeto");

	function handleValueChange(id: string, _item: ProjectItem) {
		setSelectedProjectId(id);
	}

	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
				Projeto
			</span>

			<CustomSelect
				items={projectItems}
				value={selectedProjectId ?? undefined}
				onValueChange={handleValueChange}
				variant="minimal"
				disabled={isEmpty}
				triggerClassName={cn(
					"flex items-center gap-3 px-4 py-2 rounded-lg min-w-[220px] transition-all duration-200 border-2 bg-card/80 backdrop-blur",
					accentColor ? "shadow-sm hover:shadow-md" : "border-border",
				)}
				triggerStyle={
					accent
						? {
								background: `linear-gradient(135deg, ${accent.soft} 0%, ${accent.muted} 100%)`,
								borderColor: accent.border,
								boxShadow: `0 0 0 1px ${accent.border}, 0 10px 24px ${accent.glow}`,
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
									boxShadow: `0 0 0 2px ${accent?.ring ?? accentColor}, 0 0 10px ${accent?.glow ?? accentColor}`,
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
							{label}
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

export function AccentStripe() {
	const { accent } = useProjectFocus();

	if (!accent) {
		return null;
	}

	return (
		<div
			className="w-1 shrink-0 self-stretch"
			style={{
				background: `linear-gradient(to bottom, ${accent.color} 0%, ${accent.border} 55%, ${accent.soft} 100%)`,
				boxShadow: `0 0 10px ${accent.glow}`,
			}}
		/>
	);
}

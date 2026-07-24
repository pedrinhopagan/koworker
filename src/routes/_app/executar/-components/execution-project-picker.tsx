import { FolderKanban } from "lucide-react";
import { useState } from "react";

import type { RouterOutputs } from "@/client";
import { ProjectPickerDialog } from "@/components/projects/project-picker-dialog";
import { Text } from "@/components/typography";
import { cn } from "@/lib/utils";

type Project = RouterOutputs["projects"]["list"][number];

export function ExecutionProjectPicker({
	projects,
	projectId,
	onChange,
}: {
	projects: Project[];
	projectId: string;
	onChange: (projectId: string) => void;
}) {
	const [open, setOpen] = useState(false);
	const selectedProject = projects.find((project) => project.id === projectId);

	return (
		<>
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">
				<Text size="xs">Projeto</Text>
				<button
					type="button"
					onClick={() => setOpen(true)}
					className="flex h-9 min-w-0 items-center gap-3 border border-input bg-card px-3 text-left text-sm transition-colors hover:border-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
				>
					<span
						className={cn(
							"flex size-4 shrink-0 items-center justify-center",
							!selectedProject && "text-muted-foreground",
						)}
						style={selectedProject ? { backgroundColor: selectedProject.color } : undefined}
					>
						{!selectedProject && <FolderKanban className="size-4" />}
					</span>
					<span
						className={cn("min-w-0 flex-1 truncate", !selectedProject && "text-muted-foreground")}
					>
						{selectedProject?.name ?? "Escolher projeto"}
					</span>
				</button>
			</div>

			<ProjectPickerDialog
				open={open}
				onClose={() => setOpen(false)}
				projects={projects.map((project) => ({
					id: project.id,
					name: project.name,
					color: project.color,
					displayPath: project.displayPath,
				}))}
				value={projectId}
				onSelect={(value) => {
					onChange(value);
					setOpen(false);
				}}
			/>
		</>
	);
}

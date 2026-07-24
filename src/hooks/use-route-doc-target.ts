import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";

import { orpc } from "@/client";
import type { TaskStage } from "@/constants/complexity";
import { useProjectFocus } from "@/hooks/use-project-focus";
import { useSkillQuery } from "@/hooks/use-skills";

type RouteKind = "task" | "vault" | "docs" | "skill" | "none";

export type RouteDocTarget = {
	kind: RouteKind;
	path: string | null;
	projectName?: string;
	projectId?: string;
	taskId?: string;
	categoryStructureSlug?: string | null;
	nextStage?: TaskStage | null;
};

export function useRouteDocTarget(): RouteDocTarget {
	const params = useParams({ strict: false });
	const { selectedProject } = useProjectFocus();

	const firstTaskSegment = params.taskId;
	const secondTaskSegment = params.file;
	const canonicalFile = params.canonicalFile;
	const fileName = params.fileName;
	const slug = params.slug;
	const splat = params._splat;

	const nonTaskKind: RouteKind = fileName ? "vault" : slug ? "skill" : splat ? "docs" : "none";

	const firstTaskQuery = useQuery({
		...orpc.tasks.getFull.queryOptions({ input: { id: firstTaskSegment ?? "" } }),
		enabled: !!firstTaskSegment && !fileName && !slug && !splat && !canonicalFile,
	});
	const secondTaskQuery = useQuery({
		...orpc.tasks.getFull.queryOptions({ input: { id: secondTaskSegment ?? "" } }),
		enabled: !!secondTaskSegment && !fileName && !slug && !splat,
	});

	const skillQuery = useSkillQuery(slug ?? "", selectedProject?.name, {
		enabled: nonTaskKind === "skill",
	});

	const task = canonicalFile ? secondTaskQuery.data : (secondTaskQuery.data ?? firstTaskQuery.data);
	if (task) {
		const activeFile = canonicalFile || (firstTaskQuery.data ? secondTaskSegment : undefined);
		return {
			kind: "task",
			path: activeFile ? `${task.folderPath}/${activeFile}` : task.folderPath,
			projectName: task?.project?.name,
			projectId: task?.project?.id,
			taskId: task.id,
			categoryStructureSlug: task?.category?.structureSlug ?? null,
			nextStage: task?.nextStage ?? null,
		};
	}

	if (nonTaskKind === "vault") {
		return {
			kind: nonTaskKind,
			path: `.koworker/${fileName}`,
			projectName: selectedProject?.name,
			projectId: selectedProject?.id,
		};
	}

	if (nonTaskKind === "docs") {
		return {
			kind: nonTaskKind,
			path: splat ?? null,
			projectName: selectedProject?.name,
			projectId: selectedProject?.id,
		};
	}

	if (nonTaskKind === "skill") {
		const dir = skillQuery.skill?.primaryDir ?? null;
		return {
			kind: nonTaskKind,
			path: dir ? `${dir}/SKILL.md` : null,
			projectName: selectedProject?.name,
			projectId: selectedProject?.id,
		};
	}

	return {
		kind: "none",
		path: null,
		projectName: selectedProject?.name,
		projectId: selectedProject?.id,
	};
}

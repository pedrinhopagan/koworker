import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { cn } from "@/lib/utils";
import type { Project } from "../-utils/use-projects-data";
import { ProjectCard } from "./project-card";

type ProjectListProps = {
	projects: Project[];
	selectedId: string | undefined;
	loading: boolean;
};

export function ProjectList({ projects, selectedId, loading }: ProjectListProps) {
	const queryClient = useQueryClient();
	const projectsQueryKey = orpc.projects.overview.queryOptions().queryKey;
	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(
		() => () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		},
		[],
	);

	const reorderMutation = useMutation({
		...orpc.projects.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: projectsQueryKey });
			const previous = queryClient.getQueryData(projectsQueryKey) as Project[] | undefined;
			if (previous?.length) {
				const byId = new Map(previous.map((project) => [project.id, project] as const));
				const next = orderedIds
					.map((id, index) => {
						const project = byId.get(id);
						return project ? { ...project, displayOrder: index } : null;
					})
					.filter(Boolean) as Project[];
				queryClient.setQueryData(projectsQueryKey, next);
			}
			return { previous };
		},
		onError: (_error, _variables, context) => {
			if (context?.previous) queryClient.setQueryData(projectsQueryKey, context.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: projectsQueryKey });
				queryClient.invalidateQueries({ queryKey: orpc.projects.list.queryOptions().queryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...projects].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[projects],
	);
	const [orderedItems, setOrderedItems] = useState<Project[]>([]);

	useEffect(() => {
		setOrderedItems((previous) => {
			if (
				previous.length === sorted.length &&
				previous.every((item, index) => item.id === sorted[index]?.id)
			) {
				return previous;
			}
			return sorted;
		});
	}, [sorted]);

	function renderItem(project: Project, props: SortableItemRenderProps) {
		return (
			<div className={cn("flex w-full items-stretch gap-2", props.isDragging && "opacity-60")}>
				<div className="flex items-center">
					<DragHandle
						attributes={props.dragHandleProps.attributes}
						listeners={props.dragHandleProps.listeners}
						className="p-0"
					/>
				</div>
				<div className="min-w-0 flex-1">
					<ProjectCard project={project} isSelected={project.id === selectedId} />
				</div>
			</div>
		);
	}

	return (
		<section className="flex flex-col gap-4 md:min-h-0 md:flex-1">
			<div className="flex items-center justify-between">
				<Title size="sm">Meus projetos</Title>
				<Button variant="secondary" asChild>
					<Link to="/projetos/novo">Novo projeto</Link>
				</Button>
			</div>

			{loading ? (
				<Text size="sm" tone="muted">
					Carregando projetos...
				</Text>
			) : orderedItems.length === 0 ? null : (
				<div className="pr-2 pb-6 md:min-h-0 md:flex-1 md:overflow-y-auto md:[scrollbar-gutter:stable]">
					<SortableList
						items={orderedItems}
						onReorder={(items) => {
							setOrderedItems(items);
							reorderMutation.mutate({ orderedIds: items.map((item) => item.id) });
						}}
						renderItem={renderItem}
						disabled={reorderMutation.isPending}
					/>
				</div>
			)}
		</section>
	);
}

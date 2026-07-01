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
	const projectsQueryOptions = orpc.projects.list.queryOptions();
	const projectsQueryKey = projectsQueryOptions.queryKey;

	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		};
	}, []);

	const reorderMutation = useMutation({
		...orpc.projects.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: projectsQueryKey });
			const previous = queryClient.getQueryData(projectsQueryKey) as Project[] | undefined;

			if (previous && previous.length > 0) {
				const byId = new Map(previous.map((p) => [p.id, p] as const));
				const next = orderedIds
					.map((id, index) => {
						const item = byId.get(id);
						return item ? { ...item, displayOrder: index } : null;
					})
					.filter(Boolean) as Project[];
				queryClient.setQueryData(projectsQueryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(projectsQueryKey, ctx.previous);
		},
		onSettled: () => {
			// Give the drop animation a moment before any refetch reconciles the DOM.
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: projectsQueryKey });
			}, 350);
		},
	});

	const sorted = useMemo(
		() => [...projects].sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0)),
		[projects],
	);
	const [orderedItems, setOrderedItems] = useState<Project[]>([]);

	useEffect(() => {
		// Avoid update loops: only sync when the incoming order actually changed.
		setOrderedItems((prev) => {
			if (prev.length === sorted.length && prev.every((p, i) => p.id === sorted[i]?.id)) {
				return prev;
			}
			return sorted;
		});
	}, [sorted]);

	function renderItem(project: Project, props: SortableItemRenderProps) {
		// NOTE: SortableList already wraps each item with the draggable ref + style.
		// Here we only render the visual content + the drag handle.
		return (
			<div className={cn("flex items-stretch gap-2 w-full", props.isDragging && "opacity-60")}>
				<div className="flex items-center">
					<DragHandle
						attributes={props.dragHandleProps.attributes}
						listeners={props.dragHandleProps.listeners}
						className="p-0"
					/>
				</div>
				<div className="flex-1 min-w-0">
					<ProjectCard project={project} isSelected={project.id === selectedId} />
				</div>
			</div>
		);
	}

	return (
		<section className="flex min-h-0 flex-1 flex-col gap-4">
			<div className="flex items-center justify-between">
				<div>
					<Title size="sm">Meus projetos</Title>
					<Text size="sm" tone="muted">
						{projects.length} projetos cadastrados
					</Text>
				</div>
				<Button variant="secondary" asChild>
					<Link to="/projetos/novo">Novo projeto</Link>
				</Button>
			</div>

			{loading ? (
				<Text size="sm" tone="muted">
					Carregando projetos...
				</Text>
			) : orderedItems.length === 0 ? null : (
				<div className="min-h-0 flex-1 overflow-y-auto pr-2 pb-6 [scrollbar-gutter:stable]">
					<SortableList
						items={orderedItems}
						onReorder={(items) => {
							setOrderedItems(items);
							reorderMutation.mutate({ orderedIds: items.map((i) => i.id) });
						}}
						renderItem={renderItem}
						itemClassName=""
						disabled={reorderMutation.isPending}
					/>
				</div>
			)}
		</section>
	);
}

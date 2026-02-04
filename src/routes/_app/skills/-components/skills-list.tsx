import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRightIcon, Download, Plus, RefreshCcw, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { orpc } from "@/client";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import {
	DragHandle,
	type SortableItemRenderProps,
	SortableList,
} from "@/components/ui/sortable-list";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SkillCard } from "@/routes/_app/tarefas/$taskId/-components/skill-card";
import type { SkillRecord, TaskSkill } from "@/types/skills";

type SkillItem = TaskSkill & {
	displayOrder: number;
};

type SkillsListProps = {
	skills: SkillRecord[];
	selectedId: string | null;
	onSelect: (id: string) => void;
	onNew: () => void;
	onImport: () => void;
	onExport: () => void;
	onSyncDefaults: () => void;
	importing: boolean;
	exporting: boolean;
	syncingDefaults: boolean;
	loading: boolean;
};

const DEFAULT_SKILL_ICON = "FolderOpen";
const DEFAULT_SKILL_COLOR = "#94a3b8";

function toSkillItem(skill: SkillRecord): SkillItem {
	const metadata = (skill.metadata ?? {}) as Record<string, unknown>;
	const icon = typeof metadata.icon === "string" ? metadata.icon : DEFAULT_SKILL_ICON;
	const color = typeof metadata.color === "string" ? metadata.color : DEFAULT_SKILL_COLOR;

	return {
		id: skill.id,
		slug: skill.slug,
		label: skill.name,
		description: skill.description,
		instructions: skill.content ?? "",
		icon,
		color,
		source: skill.source,
		requiresSubtaskSelection: metadata.requiresSubtaskSelection === true,
		displayOrder: typeof skill.displayOrder === "number" ? skill.displayOrder : 0,
	};
}

function isSameOrder(prev: SkillItem[], next: SkillItem[]) {
	return prev.length === next.length && prev.every((item, index) => item.id === next[index]?.id);
}

export function SkillsList({
	skills,
	selectedId,
	onSelect,
	onNew,
	onImport,
	onExport,
	onSyncDefaults,
	importing,
	exporting,
	syncingDefaults,
	loading,
}: SkillsListProps) {
	const queryClient = useQueryClient();
	const skillsQueryOptions = orpc.skills.list.queryOptions();
	const skillsQueryKey = skillsQueryOptions.queryKey;
	const invalidateTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
		};
	}, []);

	const reorderMutation = useMutation({
		...orpc.skills.reorder.mutationOptions(),
		onMutate: async ({ orderedIds }) => {
			await queryClient.cancelQueries({ queryKey: skillsQueryKey });
			const previous = queryClient.getQueryData(skillsQueryKey) as SkillRecord[] | undefined;

			if (previous && previous.length > 0) {
				const orderMap = new Map(orderedIds.map((id, index) => [id, index] as const));
				const next = previous.map((skill) => {
					const index = orderMap.get(skill.id);
					return typeof index === "number" ? { ...skill, displayOrder: index } : skill;
				});
				queryClient.setQueryData(skillsQueryKey, next);
			}

			return { previous };
		},
		onError: (_err, _vars, ctx) => {
			if (ctx?.previous) queryClient.setQueryData(skillsQueryKey, ctx.previous);
		},
		onSettled: () => {
			if (invalidateTimeoutRef.current) window.clearTimeout(invalidateTimeoutRef.current);
			invalidateTimeoutRef.current = window.setTimeout(() => {
				queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			}, 350);
		},
	});

	const managementSkills = useMemo(() => skills.map(toSkillItem), [skills]);
	const builtinSkills = useMemo(
		() =>
			managementSkills
				.filter((skill) => skill.source === "builtin")
				.sort((a, b) => a.displayOrder - b.displayOrder),
		[managementSkills],
	);
	const customSkills = useMemo(
		() =>
			managementSkills
				.filter((skill) => skill.source === "custom")
				.sort((a, b) => a.displayOrder - b.displayOrder),
		[managementSkills],
	);
	const [orderedBuiltin, setOrderedBuiltin] = useState<SkillItem[]>([]);
	const [orderedCustom, setOrderedCustom] = useState<SkillItem[]>([]);

	useEffect(() => {
		setOrderedBuiltin((prev) => (isSameOrder(prev, builtinSkills) ? prev : builtinSkills));
	}, [builtinSkills]);

	useEffect(() => {
		setOrderedCustom((prev) => (isSameOrder(prev, customSkills) ? prev : customSkills));
	}, [customSkills]);

	function renderSkillItem(skill: SkillItem, props: SortableItemRenderProps) {
		return (
			<div className={cn("flex items-stretch gap-2 w-full", props.isDragging && "opacity-60")}>
				<div className="flex items-center">
					<DragHandle
						attributes={props.dragHandleProps.attributes}
						listeners={props.dragHandleProps.listeners}
					/>
				</div>
				<div className="flex-1 min-w-0">
					<SkillCard
						skill={skill}
						variant="manage"
						isSelected={selectedId === skill.id}
						onSelect={onSelect}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6 min-h-0 min-w-0 px-4 pb-4 flex flex-col overflow-hidden transition-none">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="space-y-1">
					<Title as="h2" size="sm">
						Skills
					</Title>
					<Text size="sm" tone="muted">
						{skills.length} skill(s) cadastrada(s)
					</Text>
					<Text size="xs" tone="muted" className="flex items-center gap-1">
						Importar: Pasta {<ArrowRightIcon size={12} />} DB | Exportar: DB{" "}
						{<ArrowRightIcon size={12} />} Pasta
					</Text>
				</div>
				<div className="flex flex-wrap items-center gap-2 w-full">
					<Tooltip label="Importa da pasta de configuracao para o DB">
						<Button
							size="lg"
							variant="outline"
							onClick={onImport}
							disabled={importing}
							className="flex-1"
						>
							<Download className={cn("h-4 w-4", importing && "animate-spin")} />
							Importar
						</Button>
					</Tooltip>
					<Tooltip label="Exporta do DB para a pasta de configuracao">
						<Button
							size="lg"
							variant="outline"
							onClick={onExport}
							disabled={exporting}
							className="flex-1"
						>
							<Upload className={cn("h-4 w-4", exporting && "animate-spin")} />
							Exportar
						</Button>
					</Tooltip>
					<Button size="lg" onClick={onNew} className="flex-1">
						<Plus className="h-4 w-4" />
						Nova skill
					</Button>
				</div>
			</div>

			{loading && (
				<Text size="sm" tone="muted">
					Carregando skills...
				</Text>
			)}

			{!loading && (
				<div className="flex flex-col gap-6 flex-1 min-h-0">
					<section className="space-y-3">
						<div className="flex items-center justify-between gap-2">
							<Title as="h3" size="xs">
								Skills nativas
							</Title>
							<Tooltip label="Sincroniza defaults (recria skills nativas)">
								<Button
									size="icon-sm"
									variant="ghost"
									onClick={onSyncDefaults}
									disabled={syncingDefaults}
									className="h-7 w-7"
								>
									<RefreshCcw className={cn("h-3.5 w-3.5", syncingDefaults && "animate-spin")} />
								</Button>
							</Tooltip>
						</div>
						{orderedBuiltin.length === 0 && (
							<Text size="sm" tone="muted">
								Nenhuma skill nativa encontrada
							</Text>
						)}
						{orderedBuiltin.length > 0 && (
							<SortableList
								items={orderedBuiltin}
								onReorder={(items) => {
									setOrderedBuiltin(items);
									reorderMutation.mutate({ orderedIds: items.map((item) => item.id) });
								}}
								renderItem={renderSkillItem}
								itemClassName=""
								disabled={reorderMutation.isPending}
							/>
						)}
					</section>

					<section className="flex flex-col gap-3 flex-1 min-h-0">
						<Title as="h3" size="xs">
							Skills custom
						</Title>
						{orderedCustom.length === 0 && (
							<Text size="sm" tone="muted">
								Nenhuma skill custom encontrada
							</Text>
						)}
						{orderedCustom.length > 0 && (
							<div className="flex-1 min-h-0 overflow-y-auto pr-1">
								<SortableList
									items={orderedCustom}
									onReorder={(items) => {
										setOrderedCustom(items);
										reorderMutation.mutate({ orderedIds: items.map((item) => item.id) });
									}}
									renderItem={renderSkillItem}
									itemClassName=""
									disabled={reorderMutation.isPending}
								/>
							</div>
						)}

						<button
							type="button"
							className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground transition-colors"
							onClick={onNew}
						>
							<Plus size={16} />
							<span className="text-sm">Criar nova skill</span>
						</button>
					</section>
				</div>
			)}
		</div>
	);
}

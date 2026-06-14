import { ChevronDown, ChevronRight, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { useSkillCategoryMutations } from "@/hooks/use-skill-categories";
import { cn } from "@/lib/utils";
import type { SkillCategory } from "@/types/skills";

// Paleta sóbria pras categorias novas; cicla pela quantidade já existente.
const SKILL_CATEGORY_PALETTE = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#a855f7"];

export function SkillCategoryCreateButton({ categories }: { categories: SkillCategory[] }) {
	const { create } = useSkillCategoryMutations();
	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");

	function submit() {
		const trimmed = name.trim();
		if (!trimmed) return;
		const color = SKILL_CATEGORY_PALETTE[categories.length % SKILL_CATEGORY_PALETTE.length];
		create.mutate(
			{ name: trimmed, color },
			{
				onSuccess: () => {
					setName("");
					setCreating(false);
				},
			},
		);
	}

	if (!creating) {
		return (
			<Button variant="outline" size="sm" className="h-8" onClick={() => setCreating(true)}>
				<Plus className="size-4" />
				Nova categoria
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-1">
			<Input
				autoFocus
				value={name}
				onChange={(event) => setName(event.target.value)}
				onKeyDown={(event) => {
					if (event.key === "Enter") submit();
					if (event.key === "Escape") setCreating(false);
				}}
				placeholder="Nome da categoria"
				className="h-8 w-40"
			/>
			<Button size="sm" className="h-8" onClick={submit} disabled={create.isPending}>
				Criar
			</Button>
			<Button variant="ghost" size="icon-sm" onClick={() => setCreating(false)}>
				<X className="size-4" />
			</Button>
		</div>
	);
}

type SkillCategoryHeaderProps = {
	category?: SkillCategory;
	count: number;
	collapsed: boolean;
	onToggleCollapse: () => void;
};

export function SkillCategoryHeader({
	category,
	count,
	collapsed,
	onToggleCollapse,
}: SkillCategoryHeaderProps) {
	const { update, remove } = useSkillCategoryMutations();
	const [editing, setEditing] = useState(false);
	const [name, setName] = useState(category?.name ?? "");
	const [confirmDelete, setConfirmDelete] = useState(false);

	const ChevronIcon = collapsed ? ChevronRight : ChevronDown;

	return (
		<div className="group/header flex items-center gap-2 border-border/60 border-b pb-1">
			<button
				type="button"
				onClick={onToggleCollapse}
				className="flex min-w-0 flex-1 items-center gap-2 text-left"
			>
				<ChevronIcon className="size-4 shrink-0 text-muted-foreground" />
				{category ? (
					<span
						className="size-2.5 shrink-0 rounded-full"
						style={{ backgroundColor: category.color }}
					/>
				) : null}
				{editing && category ? null : (
					<Text
						size="sm"
						className={cn("truncate font-medium", !category && "text-muted-foreground")}
					>
						{category?.name ?? "Sem categoria"}
					</Text>
				)}
				<Text size="xs" tone="muted" className="shrink-0">
					{count}
				</Text>
			</button>

			{editing && category && (
				<Input
					autoFocus
					value={name}
					onChange={(event) => setName(event.target.value)}
					onBlur={() => setEditing(false)}
					onKeyDown={(event) => {
						if (event.key === "Enter") {
							const trimmed = name.trim();
							if (trimmed && trimmed !== category.name) {
								update.mutate(
									{ id: category.id, name: trimmed },
									{ onSuccess: () => setEditing(false) },
								);
							} else {
								setEditing(false);
							}
						}
						if (event.key === "Escape") setEditing(false);
					}}
					className="h-7 w-48"
				/>
			)}

			{category && !editing && (
				<div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100">
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Renomear categoria"
						onClick={() => {
							setName(category.name);
							setEditing(true);
						}}
					>
						<Pencil className="size-3.5" />
					</Button>
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label="Remover categoria"
						onClick={() => setConfirmDelete(true)}
					>
						<Trash2 className="size-3.5" />
					</Button>
				</div>
			)}

			{category && (
				<ConfirmDialog
					open={confirmDelete}
					onClose={() => setConfirmDelete(false)}
					onConfirm={() => {
						remove.mutate({ id: category.id });
						setConfirmDelete(false);
					}}
					title={`Remover a categoria "${category.name}"?`}
					description="As skills dela voltam para “Sem categoria”."
					confirmLabel="Remover"
					variant="danger"
				/>
			)}
		</div>
	);
}

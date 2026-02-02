import { useQuery } from "@tanstack/react-query";
import { Check, ChevronDown, Settings2 } from "lucide-react";
import { orpc } from "@/client";
import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useManageDrawerStore } from "@/stores/manage-drawers";
import { CategoryManagerDrawer } from "./CategoryManagerDrawer";

// ============================================================================
// Types
// ============================================================================

export type Category = {
	id: string;
	name: string;
	color: string | null;
};

export type CategorySelectProps = {
	value: string | null;
	onValueChange: (categoryId: string, category: Category) => void;
	disabled?: boolean;
	placeholder?: string;
	triggerClassName?: string;
	upperLabel?: boolean;
};

const MANAGE_CATEGORY_ID = "__manage_category__";

// ============================================================================
// Category Chip (reusable visual component)
// ============================================================================

type CategoryChipProps = {
	category: Category | null;
	size?: "sm" | "md";
	placeholder?: string;
};

function CategoryChip({ category, size = "md", placeholder = "Categoria" }: CategoryChipProps) {
	const color = category?.color ?? "#6b7280";
	const label = category?.name ?? placeholder;

	const sizeClasses = size === "sm" ? "text-xs" : "text-sm";

	return (
		<span className={cn("inline-flex items-center gap-2", sizeClasses)}>
			<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
			<span className="truncate text-foreground">{label}</span>
		</span>
	);
}

// ============================================================================
// CategorySelect Component
// ============================================================================

export function CategorySelect({
	value,
	onValueChange,
	disabled = false,
	placeholder = "Categoria",
	triggerClassName,
	upperLabel = false,
}: CategorySelectProps) {
	const openManageDrawer = useManageDrawerStore((s) => s.open);
	// Fetch categories internally
	const categoriesQuery = useQuery(orpc.categories.list.queryOptions());
	const categories = (categoriesQuery.data ?? []) as Category[];

	const loadError = categoriesQuery.isError ? "Não foi possível carregar categorias" : null;

	const selectedCategory = categories.find((c) => c.id === value) ?? null;
	const accentColor = selectedCategory?.color ?? "#6b7280";

	// Build items for CustomSelect
	const selectItems = [
		...categories.map((cat) => ({
			id: cat.id,
			name: cat.name,
			color: cat.color,
		})),
		{
			id: MANAGE_CATEGORY_ID,
			name: "Gerenciar categorias",
			color: null,
		},
	];

	return (
		<>
			<CustomSelect
				items={selectItems}
				value={value ?? undefined}
				onValueChange={(newValue, item) => {
					if (newValue === MANAGE_CATEGORY_ID) {
						openManageDrawer("categories");
						return;
					}
					onValueChange(newValue, item as Category);
				}}
				disabled={disabled}
				loading={categoriesQuery.isLoading}
				error={loadError}
				emptyMessage={loadError ? "" : "Nenhuma categoria"}
				variant="default"
				size="md"
				label="Categoria"
				upperLabel={upperLabel}
				renderTrigger={() => (
					<>
						<CategoryChip category={selectedCategory} placeholder={placeholder} />
						<ChevronDown className="size-4 text-muted-foreground ml-1" />
					</>
				)}
				renderItem={(item, isSelected) => {
					if (item.id === MANAGE_CATEGORY_ID) {
						return (
							<div className="w-full px-3 py-2 flex items-center gap-2 text-sm text-current opacity-70">
								<Settings2 className="size-4" />
								<span className="truncate">Gerenciar categorias</span>
							</div>
						);
					}

					const color = item.color ?? "#6b7280";

					return (
						<div
							className={cn(
								"w-full px-3 py-2 flex items-center gap-2",
								"transition-all duration-150 ease-out",
							)}
							style={{
								borderLeft: isSelected ? `2px solid ${color}` : "2px solid transparent",
							}}
						>
							<span className="size-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
							<span className={cn("flex-1 text-sm truncate", isSelected && "font-medium")}>
								{item.name}
							</span>

							{isSelected && <Check className="size-4 ml-auto shrink-0" style={{ color }} />}
						</div>
					);
				}}
				itemClassName={(item) =>
					item.id === MANAGE_CATEGORY_ID
						? "sticky bottom-0 z-10 border-t border-border bg-card"
						: ""
				}
				triggerStyle={{
					boxShadow: `0 0 0 1px ${accentColor}30`,
				}}
				triggerClassName={cn("gap-1 min-w-[140px]", triggerClassName)}
				contentClassName="min-w-[180px]"
			/>
			<CategoryManagerDrawer />
		</>
	);
}

// ============================================================================
// Exports
// ============================================================================

export { CategoryChip };
export type { CategoryChipProps };

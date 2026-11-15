import * as SelectPrimitive from "@radix-ui/react-select";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import * as React from "react";
import { tv, type VariantProps } from "tailwind-variants";

import { useThemeRootContainer } from "@/hooks/use-theme-root";
import { cn } from "@/lib/utils";
import { Text } from "../typography";

// ============================================================================
// Variants
// ============================================================================

const customSelectTriggerVariants = tv({
	base: "flex min-w-0 items-center justify-between gap-2 whitespace-nowrap outline-none transition-colors duration-150 focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
	variants: {
		variant: {
			default:
				"border border-input bg-background px-3 text-foreground shadow-xs hover:bg-accent/50 focus-visible:border-ring data-[state=open]:border-ring dark:bg-input/30 dark:hover:bg-input/60",
			ghost: "px-2 hover:bg-accent hover:text-accent-foreground data-[state=open]:bg-accent",
			minimal: "",
		},
		size: {
			sm: "h-7 text-xs",
			md: "h-8 text-sm",
			lg: "h-9 text-sm",
		},
	},
	compoundVariants: [{ variant: "default", size: "sm", class: "px-2" }],
	defaultVariants: {
		variant: "default",
		size: "md",
	},
});

const customSelectContentVariants = tv({
	base: [
		// Keep content width stable and never exceed the available popper width.
		"bg-popover text-popover-foreground border border-border p-1 shadow-xl z-50 overflow-hidden min-w-[var(--radix-select-trigger-width)] max-w-[var(--radix-popper-available-width)] flex flex-col",
		"data-[state=open]:animate-in data-[state=closed]:animate-out",
		"data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
		"data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
		"data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2",
		"data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
	],
});

const customSelectItemVariants = tv({
	base: cn(
		"relative min-w-0 cursor-pointer outline-none",
		"py-1.5 pr-8 pl-2.5 text-sm",
		"bg-transparent text-foreground",
		"data-[highlighted]:bg-accent data-[highlighted]:text-foreground",
		"data-[state=checked]:font-medium",
		"data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
	),
});

// ============================================================================
// Types
// ============================================================================

type CustomSelectTriggerRenderContext = {
	loading: boolean;
	error: string | null;
};

interface CustomSelectProps<T extends { id: string }> extends VariantProps<
	typeof customSelectTriggerVariants
> {
	items: T[];
	value?: string;
	onValueChange: (value: string, item: T) => void;
	renderItem: (item: T, isSelected: boolean) => React.ReactNode;
	itemClassName?: (item: T) => string;
	renderTrigger?: (ctx?: CustomSelectTriggerRenderContext) => React.ReactNode;
	label?: string;
	placeholder?: string;
	disabled?: boolean;
	loading?: boolean;
	error?: string | null;
	emptyMessage?: string;
	onEscapeKeyDown?: (event: KeyboardEvent) => void;
	className?: string;
	triggerClassName?: string;
	triggerStyle?: React.CSSProperties;
	ariaLabel?: string;
	contentClassName?: string;
	align?: "start" | "center" | "end";
	side?: "top" | "bottom" | "left" | "right";
	upperLabel?: boolean;
	// Por padrão o select cresce (flex-1) pra preencher o container. Com fitContent ele encolhe ao
	// conteúdo do trigger — usado pelos triggers compactos (ícone + chevron).
	fitContent?: boolean;
}

// ============================================================================
// Components
// ============================================================================

function CustomSelect<T extends { id: string }>({
	items,
	value,
	onValueChange,
	renderItem,
	itemClassName,
	renderTrigger,
	label,
	placeholder = "Selecione...",
	disabled = false,
	loading = false,
	error = null,
	emptyMessage = "Nenhum item disponível",
	onEscapeKeyDown,
	variant,
	size,
	className,
	triggerClassName,
	triggerStyle,
	ariaLabel,
	contentClassName,
	align = "start",
	side = "bottom",
	upperLabel = false,
	fitContent = false,
}: CustomSelectProps<T>) {
	function handleValueChange(newValue: string) {
		const item = items.find((i) => i.id === newValue);
		if (item) {
			onValueChange(newValue, item);
		}
	}

	const isDisabled = disabled || loading;
	const isEmpty = items.length === 0;
	const portalContainer = useThemeRootContainer();
	const contentStyle: React.CSSProperties = {
		backgroundColor: "var(--popover)",
		color: "var(--popover-foreground)",
	};

	return (
		<div className={cn("flex flex-col gap-0.5", fitContent ? "w-fit" : "flex-1")}>
			{upperLabel && (
				<div className="flex items-center justify-between">
					<Text size="xs">{label}</Text>
				</div>
			)}

			<SelectPrimitive.Root value={value} onValueChange={handleValueChange} disabled={isDisabled}>
				<SelectPrimitive.Trigger
					type="button"
					aria-label={ariaLabel}
					data-slot="custom-select-trigger"
					aria-busy={loading ? true : undefined}
					aria-invalid={error ? true : undefined}
					className={cn(
						customSelectTriggerVariants({ variant, size }),
						className,
						triggerClassName,
					)}
					style={triggerStyle}
				>
					{renderTrigger ? (
						renderTrigger({ loading, error })
					) : (
						<>
							<SelectPrimitive.Value
								placeholder={placeholder}
								className="min-w-0 flex-1 truncate text-left"
							/>
							<SelectPrimitive.Icon asChild>
								<ChevronDown className="size-4 shrink-0 text-muted-foreground" />
							</SelectPrimitive.Icon>
						</>
					)}

					{loading && (
						<span className="ml-2 inline-flex items-center" aria-hidden="true">
							<Loader2 className="size-4 animate-spin text-muted-foreground" />
						</span>
					)}

					{!loading && error && (
						<span className="ml-2 inline-flex items-center" aria-hidden="true">
							<AlertCircle className="size-4 text-destructive" />
						</span>
					)}
				</SelectPrimitive.Trigger>

				<SelectPrimitive.Portal container={portalContainer ?? undefined}>
					<SelectPrimitive.Content
						data-slot="custom-select-content"
						position="popper"
						align={align}
						side={side}
						sideOffset={8}
						onEscapeKeyDown={onEscapeKeyDown}
						className={cn(customSelectContentVariants(), contentClassName)}
						style={contentStyle}
					>
						{(label || error) && (
							<div className="border-b border-border px-2.5 py-2">
								{label && <div className="text-xs text-muted-foreground font-medium">{label}</div>}
								{error && <div className="mt-1 text-xs text-destructive">{error}</div>}
							</div>
						)}

						<SelectPrimitive.Viewport
							className="max-h-48 w-full min-w-0 overflow-y-auto bg-popover text-popover-foreground"
							style={contentStyle}
						>
							{loading ? (
								<div className="px-2.5 py-1.5 text-sm text-muted-foreground">Carregando...</div>
							) : isEmpty ? (
								<div className="px-2.5 py-1.5 text-sm text-muted-foreground">{emptyMessage}</div>
							) : (
								items.map((item) => (
									<SelectPrimitive.Item
										key={item.id}
										value={item.id}
										data-component="custom-select-item"
										data-value={item.id}
										data-slot="custom-select-item"
										className={cn(customSelectItemVariants(), itemClassName?.(item))}
									>
										<SelectPrimitive.ItemText asChild>
											<div className="w-full min-w-0 overflow-hidden">
												{renderItem(item, value === item.id)}
											</div>
										</SelectPrimitive.ItemText>
										<SelectPrimitive.ItemIndicator className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center">
											<Check className="size-3.5 text-primary" />
										</SelectPrimitive.ItemIndicator>
									</SelectPrimitive.Item>
								))
							)}
						</SelectPrimitive.Viewport>
					</SelectPrimitive.Content>
				</SelectPrimitive.Portal>
			</SelectPrimitive.Root>
		</div>
	);
}

// ============================================================================
// Inline edit helper
// ============================================================================

type CustomSelectInlineEditInputProps = Omit<
	React.ComponentProps<"input">,
	"value" | "defaultValue" | "onChange"
> & {
	value: string;
	onCommit: (nextValue: string) => void;
	onCancel?: () => void;
};

/**
 * Input helper meant to be rendered inside a CustomSelect item.
 *
 * It:
 * - stays within the item width (w-full/min-w-0)
 * - prevents pointer/keyboard events from bubbling to Radix Select
 * - supports Enter (commit), Escape (cancel), Blur (commit)
 */
function CustomSelectInlineEditInput({
	value,
	onCommit,
	onCancel,
	className,
	onKeyDown,
	onBlur,
	...props
}: CustomSelectInlineEditInputProps) {
	const [draft, setDraft] = React.useState(value);

	React.useEffect(() => {
		setDraft(value);
	}, [value]);

	function commit() {
		const next = draft.trim();
		if (next !== value) {
			onCommit(next);
		}
	}

	function cancel() {
		setDraft(value);
		onCancel?.();
	}

	return (
		<input
			{...props}
			value={draft}
			onChange={(e) => setDraft(e.target.value)}
			className={cn(
				"w-full min-w-0 bg-transparent outline-none truncate",
				// keep the input from expanding the row
				"text-ellipsis",
				className,
			)}
			onPointerDown={(e) => {
				// Prevent selecting the item / closing the select when trying to edit.
				e.stopPropagation();
			}}
			onClick={(e) => e.stopPropagation()}
			onKeyDown={(e) => {
				// Prevent Radix Select keyboard handling while typing.
				e.stopPropagation();

				if (e.key === "Enter") {
					e.preventDefault();
					commit();
					return;
				}

				if (e.key === "Escape") {
					e.preventDefault();
					cancel();
					return;
				}

				onKeyDown?.(e);
			}}
			onBlur={(e) => {
				commit();
				onBlur?.(e);
			}}
		/>
	);
}

// ============================================================================
// Exports
// ============================================================================

export {
	CustomSelect,
	CustomSelectInlineEditInput,
	customSelectContentVariants,
	customSelectItemVariants,
	customSelectTriggerVariants,
};
export type { CustomSelectInlineEditInputProps, CustomSelectProps };

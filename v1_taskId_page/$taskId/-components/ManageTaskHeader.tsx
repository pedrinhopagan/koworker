import { CustomSelect } from "@/components/ui/custom-select";
import { cn } from "@/lib/utils";
import { useNavigate } from "@tanstack/react-router";
import { Bot, Check, ChevronDown, ChevronLeft, FileText } from "lucide-react";

const CATEGORIES = [
	{ id: "feature", name: "feature", color: "#61afef" },
	{ id: "bug", name: "bug", color: "#e06c75" },
	{ id: "refactor", name: "refactor", color: "#98c379" },
	{ id: "test", name: "test", color: "#e5c07b" },
	{ id: "docs", name: "docs", color: "#c678dd" },
];

const PRIORITIES = [
	{ id: "1", name: "Alta", color: "#bc5653" },
	{ id: "2", name: "Média", color: "#ebc17a" },
	{ id: "3", name: "Baixa", color: "#8b7355" },
];

interface ManageTaskHeaderProps {
	title: string;
	category: string;
	priority: number;
	isSaving: boolean;
	aiUpdatedRecently: boolean;
	isOpenCodeConnected: boolean;
	projectColor?: string;
	onTitleChange: (title: string) => void;
	onTitleBlur: () => void;
	onCategoryChange: (category: string) => void;
	onPriorityChange: (priority: number) => void;
}

export function ManageTaskHeader({
	title,
	category,
	priority,
	isSaving,
	aiUpdatedRecently,
	isOpenCodeConnected,
	projectColor,
	onTitleChange,
	onTitleBlur,
	onCategoryChange,
	onPriorityChange,
}: ManageTaskHeaderProps) {
	const navigate = useNavigate();
	const accentColor = projectColor || "hsl(var(--primary))";

	function goBack() {
		navigate({ to: "/tasks" });
	}

	return (
		<div
			className="relative border-b border-border animate-fade-in"
			style={{
				background: `linear-gradient(135deg, ${accentColor}15 0%, transparent 60%), var(--background)`,
			}}
		>
			{/* Left accent bar */}
			<div
				className="absolute left-0 top-0 bottom-0 w-1"
				style={{
					background: `linear-gradient(180deg, ${accentColor} 0%, ${accentColor}60 100%)`,
				}}
			/>

			<div className="flex items-center gap-3 p-3 pl-4">
				<button
					type="button"
					onClick={goBack}
					className="text-muted-foreground hover:text-foreground transition-all duration-200 p-1.5 hover:bg-secondary/50 active:scale-95"
					title="Voltar"
				>
					<ChevronLeft size={18} />
				</button>

				{/* Task icon with glow */}
				<div
					className="shrink-0 p-1.5 animate-scale-in"
					style={{
						color: accentColor,
						boxShadow: `0 0 12px ${accentColor}30`,
					}}
				>
					<FileText size={18} />
				</div>

				<input
					type="text"
					value={title}
					onChange={(e) => onTitleChange(e.target.value)}
					onBlur={onTitleBlur}
					className="flex-1 bg-transparent text-foreground text-base font-medium focus:outline-none border-b border-transparent focus:border-primary transition-colors"
				/>

				<CustomSelect
					items={CATEGORIES}
					value={category}
					onValueChange={(id) => onCategoryChange(id)}
					triggerClassName={cn(
						"flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card min-w-[100px]",
						"hover:bg-popover hover:border-muted-foreground transition-colors",
					)}
					contentClassName="min-w-[140px]"
					renderTrigger={() => {
						const selected = CATEGORIES.find((c) => c.id === category);
						return (
							<>
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: selected?.color || "#6b7280" }}
								/>
								<span className="flex-1 text-sm text-foreground truncate text-left">
									{selected?.name || "Categoria"}
								</span>
								<ChevronDown className="size-3 text-muted-foreground shrink-0" />
							</>
						);
					}}
					renderItem={(item, isSelected) => (
						<div
							className={cn(
								"flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
								isSelected ? "bg-popover" : "hover:bg-popover",
							)}
						>
							<span
								className="size-2 rounded-full shrink-0"
								style={{ backgroundColor: item.color }}
							/>
							<span
								className={cn(
									"flex-1 text-sm truncate",
									isSelected ? "text-foreground font-medium" : "text-foreground",
								)}
							>
								{item.name}
							</span>
							{isSelected && <Check className="size-3 text-primary shrink-0" />}
						</div>
					)}
				/>

				<CustomSelect
					items={PRIORITIES}
					value={String(priority)}
					onValueChange={(id) => onPriorityChange(Number.parseInt(id, 10))}
					triggerClassName={cn(
						"flex items-center gap-2 px-3 py-1.5 rounded-md border border-border bg-card min-w-[90px]",
						"hover:bg-popover hover:border-muted-foreground transition-colors",
					)}
					contentClassName="min-w-[120px]"
					renderTrigger={() => {
						const selected = PRIORITIES.find((p) => p.id === String(priority));
						return (
							<>
								<span
									className="size-2 rounded-full shrink-0"
									style={{ backgroundColor: selected?.color || "#6b7280" }}
								/>
								<span className="flex-1 text-sm text-foreground truncate text-left">
									{selected?.name || "Prioridade"}
								</span>
								<ChevronDown className="size-3 text-muted-foreground shrink-0" />
							</>
						);
					}}
					renderItem={(item, isSelected) => (
						<div
							className={cn(
								"flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors",
								isSelected ? "bg-popover" : "hover:bg-popover",
							)}
						>
							<span
								className="size-2 rounded-full shrink-0"
								style={{ backgroundColor: item.color }}
							/>
							<span
								className={cn(
									"flex-1 text-sm truncate",
									isSelected ? "text-foreground font-medium" : "text-foreground",
								)}
							>
								{item.name}
							</span>
							{isSelected && <Check className="size-3 text-primary shrink-0" />}
						</div>
					)}
				/>

				{isSaving && (
					<span className="text-xs text-muted-foreground animate-pulse">Salvando...</span>
				)}

				{aiUpdatedRecently && (
					<span className="text-xs text-primary flex items-center gap-1 animate-pulse">
						<Bot size={14} />
						IA atualizou
					</span>
				)}

				<div
					className={`w-2 h-2 transition-all duration-300 ${isOpenCodeConnected ? "animate-glow-pulse" : ""}`}
					style={{
						backgroundColor: isOpenCodeConnected ? accentColor : "hsl(var(--muted-foreground))",
						boxShadow: isOpenCodeConnected ? `0 0 8px ${accentColor}80` : "none",
					}}
					title={
						isOpenCodeConnected
							? "OpenCode conectado - atualizações em tempo real"
							: "OpenCode desconectado"
					}
				/>
			</div>
		</div>
	);
}

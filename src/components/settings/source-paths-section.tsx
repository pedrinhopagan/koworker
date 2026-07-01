import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { isTauri, pickProjectFolder } from "@/lib/tauri";

type PathRow = { id: string; tool: string; path: string };

type SourcePathsSectionProps<T extends string> = {
	title: string;
	tools: readonly T[];
	toolLabel: Record<T, string>;
	defaultTool: T;
	placeholder: string;
	help: ReactNode;
	emptyText: string;
	paths: PathRow[];
	loading: boolean;
	adding: boolean;
	onAdd: (input: { tool: T; path: string }) => void;
	onRemove: (id: string) => void;
};

export function SourcePathsSection<T extends string>({
	title,
	tools,
	toolLabel,
	defaultTool,
	placeholder,
	help,
	emptyText,
	paths,
	loading,
	adding,
	onAdd,
	onRemove,
}: SourcePathsSectionProps<T>) {
	const canPick = isTauri();
	const [tool, setTool] = useState<T>(defaultTool);
	const [path, setPath] = useState("");
	const [picking, setPicking] = useState(false);

	function handleAdd() {
		const trimmed = path.trim();
		if (!trimmed) return;
		onAdd({ tool, path: trimmed });
		setPath("");
	}

	async function handlePick() {
		if (!canPick || picking) return;
		setPicking(true);
		const selected = await pickProjectFolder(path.trim() || undefined);
		if (selected) setPath(selected);
		setPicking(false);
	}

	return (
		<section className="space-y-2">
			<Title as="div" size="sm">
				{title}
			</Title>
			<div className="flex flex-col gap-2 border border-border bg-card/50 p-3">
				<div className="flex items-center gap-2">
					<Select value={tool} onValueChange={(value) => setTool(value as T)}>
						<SelectTrigger className="h-9 w-44 shrink-0">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{tools.map((entry) => (
								<SelectItem key={entry} value={entry}>
									{toolLabel[entry]}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						value={path}
						onChange={(event) => setPath(event.target.value)}
						placeholder={placeholder}
						className="h-9 flex-1 font-mono"
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								handleAdd();
							}
						}}
					/>
					{canPick && (
						<Button
							type="button"
							variant="outline"
							onClick={handlePick}
							disabled={picking}
							className="h-9 shrink-0 px-3"
						>
							...
						</Button>
					)}
				</div>
				<Button
					type="button"
					onClick={handleAdd}
					disabled={adding || !path.trim()}
					className="self-end"
				>
					<Plus className="mr-2 size-4" />
					Adicionar
				</Button>
			</div>
			<Text size="xs" tone="muted">
				{help}
			</Text>

			{loading ? (
				<Text size="sm" tone="muted">
					Carregando...
				</Text>
			) : paths.length === 0 ? (
				<Text size="sm" tone="muted">
					{emptyText}
				</Text>
			) : (
				<div className="divide-y divide-border border border-border bg-card">
					{paths.map((entry) => (
						<div key={entry.id} className="flex items-center gap-3 px-3 py-2">
							<Chip size="xs" variant="outline" className="shrink-0">
								{toolLabel[entry.tool as T] ?? entry.tool}
							</Chip>
							<span className="min-w-0 flex-1 truncate font-mono text-xs">{entry.path}</span>
							<Tooltip label="Remover caminho">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={() => onRemove(entry.id)}
									aria-label="Remover caminho"
									className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
								>
									<Trash2 className="size-3.5" />
								</Button>
							</Tooltip>
						</div>
					))}
				</div>
			)}
		</section>
	);
}

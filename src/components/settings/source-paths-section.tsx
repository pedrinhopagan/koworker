import { Plus, Trash2 } from "lucide-react";
import { type ReactNode, useState } from "react";

import { FolderPathInput } from "@/components/settings/folder-path-input";
import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { CustomSelect } from "@/components/ui/custom-select";
import { Tooltip } from "@/components/ui/tooltip";

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
	const [tool, setTool] = useState<T>(defaultTool);
	const [path, setPath] = useState("");

	function handleAdd() {
		const trimmed = path.trim();
		if (!trimmed) return;
		onAdd({ tool, path: trimmed });
		setPath("");
	}

	return (
		<section className="space-y-2">
			<Title as="div" size="sm">
				{title}
			</Title>
			<div className="flex flex-col gap-2 border border-border bg-card/50 p-3">
				<div className="flex items-center gap-2">
					<CustomSelect
						items={tools.map((entry) => ({ id: entry, label: toolLabel[entry] }))}
						value={tool}
						onValueChange={(value) => setTool(value as T)}
						renderItem={(item) => item.label}
						fitContent
						triggerClassName="h-9 w-44 shrink-0"
					/>
					<FolderPathInput
						value={path}
						onChange={setPath}
						onEnter={handleAdd}
						placeholder={placeholder}
						className="flex-1"
					/>
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

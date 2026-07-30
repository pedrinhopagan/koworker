import { FolderKanban, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Text, Title } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRovingListbox, useRovingOption } from "@/hooks/use-roving-listbox";

export type ProjectPickerItem = {
	id: string;
	name: string;
	color: string | null;
	displayPath?: string;
};

export function ProjectPickerDialog({
	open,
	onClose,
	projects,
	value,
	onSelect,
	loading = false,
	disabled = false,
	allOption,
}: {
	open: boolean;
	onClose: () => void;
	projects: ProjectPickerItem[];
	value?: string;
	onSelect: (projectId: string) => void;
	loading?: boolean;
	disabled?: boolean;
	allOption?: ProjectPickerItem;
}) {
	const [query, setQuery] = useState("");

	useEffect(() => {
		if (open) {
			setQuery("");
		}
	}, [open]);

	const items = useMemo(() => {
		const normalized = query.trim().toLocaleLowerCase("pt-BR");
		return [...(allOption ? [allOption] : []), ...projects].filter((project) => {
			if (!normalized) {
				return true;
			}

			return `${project.name} ${project.displayPath ?? ""}`
				.toLocaleLowerCase("pt-BR")
				.includes(normalized);
		});
	}, [allOption, projects, query]);

	const { activeIndex, focusedIndex, setActiveIndex, onKeyDown } = useRovingListbox({
		count: items.length,
		onSelect: (index) => {
			const project = items[index];
			if (project && !disabled) {
				onSelect(project.id);
			}
		},
	});

	useEffect(() => {
		setActiveIndex(0);
	}, [query, setActiveIndex]);

	return (
		<Dialog
			open={open}
			onClose={onClose}
			title="Escolher projeto"
			description="Busque pelo nome ou diretório do projeto."
			className="max-w-2xl"
		>
			{/** biome-ignore lint/a11y/noStaticElementInteractions: teclado do listbox; o alvo real é a busca ou uma opção. */}
			<div onKeyDown={onKeyDown}>
				<div className="relative">
					<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={query}
						onChange={(event) => setQuery(event.target.value)}
						placeholder="Buscar projeto…"
						className="pr-10 pl-10"
						autoFocus
					/>
					{query && (
						<Button
							type="button"
							variant="ghost"
							size="icon-sm"
							onClick={() => setQuery("")}
							className="absolute top-1/2 right-1 -translate-y-1/2"
							aria-label="Limpar busca"
						>
							<X className="size-4" />
						</Button>
					)}
				</div>

				<div className="my-3 flex items-center justify-between gap-3 border-b border-border pb-2">
					<Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
						Projetos
					</Text>
					<Text size="xs" tone="muted">
						{items.length} {items.length === 1 ? "resultado" : "resultados"}
					</Text>
				</div>

				{loading && <Text tone="muted">Carregando projetos…</Text>}

				{!loading && items.length === 0 && (
					<div className="border border-dashed border-border p-8 text-center">
						<FolderKanban className="mx-auto mb-3 size-5 text-muted-foreground" />
						<Title as="h3" size="sm">
							Nenhum projeto encontrado
						</Title>
						<Text size="sm" tone="muted">
							Tente outro nome ou diretório.
						</Text>
					</div>
				)}

				<div
					className="flex flex-col gap-2 md:gap-1"
					role="listbox"
					aria-label="Projetos disponíveis"
				>
					{!loading &&
						items.map((project, index) => (
							<ProjectPickerOption
								key={project.id}
								project={project}
								selected={project.id === value}
								active={index === activeIndex}
								focused={index === focusedIndex}
								disabled={disabled}
								onActivate={() => setActiveIndex(index)}
								onSelect={() => onSelect(project.id)}
							/>
						))}
				</div>
			</div>
		</Dialog>
	);
}

function ProjectPickerOption({
	project,
	selected,
	active,
	focused,
	disabled,
	onActivate,
	onSelect,
}: {
	project: ProjectPickerItem;
	selected: boolean;
	active: boolean;
	focused: boolean;
	disabled: boolean;
	onActivate: () => void;
	onSelect: () => void;
}) {
	const ref = useRovingOption<HTMLDivElement>(focused);

	return (
		/** biome-ignore lint/a11y/noStaticElementInteractions: opção de listbox; o teclado é tratado no container. */
		<div
			ref={ref}
			role="option"
			aria-selected={selected}
			tabIndex={active ? 0 : -1}
			onClick={() => {
				if (!disabled) {
					onSelect();
				}
			}}
			onFocus={onActivate}
			onMouseEnter={onActivate}
			className="group flex min-h-16 cursor-pointer items-center gap-3 border border-border bg-card px-4 py-3 text-left outline-none transition-colors hover:bg-muted/30 focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50 md:min-h-12 md:gap-2 md:px-3 md:py-2"
		>
			<span
				className="flex size-9 shrink-0 items-center justify-center border border-border bg-background md:size-7"
				style={project.color ? { backgroundColor: project.color } : undefined}
			>
				{!project.color && <FolderKanban className="size-4 text-muted-foreground md:size-3.5" />}
			</span>
			<span className="min-w-0 flex-1">
				<Title as="div" size="sm" className="truncate">
					{project.name}
				</Title>
				{project.displayPath && (
					<Text size="xs" tone="muted" className="truncate font-mono">
						{project.displayPath}
					</Text>
				)}
			</span>
			<Checkbox
				checked={selected}
				disabled={disabled}
				tabIndex={-1}
				onClick={(event) => event.stopPropagation()}
				onCheckedChange={onSelect}
				aria-label={`Selecionar ${project.name}`}
				className="size-5 md:size-4"
			/>
		</div>
	);
}

import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, CornerDownLeft, Search } from "lucide-react";
import { useEffect, useId, useState, type KeyboardEvent } from "react";

import { sidebarNavGroups } from "@/components/layout/sidebar-nav-config";
import { Text } from "@/components/typography";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function normalizePageLabel(label: string) {
	return label
		.toLocaleLowerCase("pt-BR")
		.normalize("NFD")
		.replaceAll(/\p{Diacritic}/gu, "");
}

export function NavigationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
	return (
		<Dialog open={open} onClose={onClose} title="Ir para uma página" className="max-w-xl">
			{open && <NavigationSearch onClose={onClose} />}
		</Dialog>
	);
}

function NavigationSearch({ onClose }: { onClose: () => void }) {
	const navigate = useNavigate();
	const listId = useId();
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const normalizedQuery = normalizePageLabel(query);
	const pages = sidebarNavGroups.flatMap((group) =>
		group.items.flatMap((item) => {
			if (item.kind !== "route" || !normalizePageLabel(item.label).includes(normalizedQuery)) {
				return [];
			}
			return [{ ...item, group: group.label }];
		}),
	);

	useEffect(() => {
		document
			.querySelector(`[id="${listId}-${selectedIndex}"]`)
			?.scrollIntoView({ block: "nearest" });
	}, [listId, selectedIndex, query]);

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "ArrowDown" || event.key === "ArrowUp") {
			event.preventDefault();
			const step = event.key === "ArrowDown" ? 1 : -1;
			setSelectedIndex((index) => (index + step + pages.length) % Math.max(1, pages.length));
		}
		if (event.key === "Enter") {
			const page = pages.at(selectedIndex);
			if (page) {
				event.preventDefault();
				onClose();
				void navigate({ to: page.path });
			}
		}
	}

	return (
		<div className="flex flex-col gap-3">
			<div className="relative">
				<Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
				<Input
					autoFocus
					role="combobox"
					aria-label="Buscar página"
					aria-expanded
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={pages.length ? `${listId}-${selectedIndex}` : undefined}
					placeholder="Buscar página..."
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setSelectedIndex(0);
					}}
					onKeyDown={handleKeyDown}
					className="h-11 pl-9"
				/>
			</div>
			<div
				id={listId}
				role="listbox"
				aria-label="Páginas"
				className="max-h-80 overflow-y-auto rounded-lg"
			>
				{pages.map((page, index) => (
					<Link
						key={page.path}
						id={`${listId}-${index}`}
						role="option"
						aria-selected={index === selectedIndex}
						to={page.path}
						onClick={onClose}
						onPointerMove={() => setSelectedIndex(index)}
						className={cn(
							"flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring",
							index === selectedIndex && "bg-accent",
						)}
					>
						<page.icon className="size-4 shrink-0 text-muted-foreground" />
						<span className="flex-1">{page.label}</span>
						<span className="text-xs text-muted-foreground">{page.group}</span>
					</Link>
				))}
				{pages.length === 0 && (
					<Text size="sm" tone="muted" className="px-3 py-8 text-center">
						Nenhuma página encontrada.
					</Text>
				)}
			</div>
			<div className="flex items-center gap-4 border-t border-border pt-3 text-xs text-muted-foreground">
				<span className="inline-flex items-center gap-1.5">
					<ArrowUpDown className="size-3" />
					Escolher
				</span>
				<span className="inline-flex items-center gap-1.5">
					<CornerDownLeft className="size-3" />
					Abrir
				</span>
				<span className="ml-auto">Esc para fechar</span>
			</div>
		</div>
	);
}

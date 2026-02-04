import * as LucideIcons from "lucide-react";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LucideIcon } from "@/lib/lucide-icon";
import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Input } from "./input";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

const DEFAULT_ICON = "FolderOpen";
const PAGE_SIZE = 120;

type IconSelectorProps = {
	value?: string;
	onChange: (icon: string) => void;
	className?: string;
	showLabel?: boolean;
	disabled?: boolean;
};

export function IconSelector({
	value,
	onChange,
	className,
	showLabel = false,
	disabled = false,
}: IconSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [isFetchingNextPage, setIsFetchingNextPage] = useState(false);
	const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const iconNames = useMemo(() => {
		const exportedIcons = (LucideIcons as { icons?: Record<string, unknown> }).icons;
		if (exportedIcons && Object.keys(exportedIcons).length > 0) {
			return Object.keys(exportedIcons).sort((a, b) => a.localeCompare(b));
		}

		const excluded = new Set(["default", "icons", "createLucideIcon", "Icon", "LucideIcon"]);
		return Object.keys(LucideIcons)
			.filter((name) => {
				if (excluded.has(name)) return false;
				if (name.startsWith("Lucide") || name.endsWith("Icon")) return false;
				const value = (LucideIcons as Record<string, unknown>)[name];
				return typeof value === "function";
			})
			.sort((a, b) => a.localeCompare(b));
	}, []);
	const fallbackIcon = iconNames.includes(DEFAULT_ICON)
		? DEFAULT_ICON
		: (iconNames[0] ?? DEFAULT_ICON);
	const currentIcon = value && iconNames.includes(value) ? value : fallbackIcon;
	const normalizedSearch = search.trim().toLowerCase();

	const filteredIcons = useMemo(() => {
		if (!normalizedSearch) return iconNames;
		return iconNames.filter((name) => {
			const normalizedName = name.toLowerCase();
			const spacedName = name.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
			return normalizedName.includes(normalizedSearch) || spacedName.includes(normalizedSearch);
		});
	}, [iconNames, normalizedSearch]);
	const totalPages = Math.max(1, Math.ceil(filteredIcons.length / PAGE_SIZE));
	const hasNextPage = page < totalPages;
	const visibleIcons = useMemo(
		() => filteredIcons.slice(0, page * PAGE_SIZE),
		[filteredIcons, page],
	);

	function handleOpenChange(nextOpen: boolean) {
		setOpen(nextOpen);
		if (!nextOpen) {
			setSearch("");
		}
	}

	function handleSelect(iconName: string) {
		onChange(iconName);
		setOpen(false);
	}

	function handleScroll(event: React.UIEvent<HTMLDivElement>) {
		if (isFetchingNextPage || !hasNextPage) return;
		const target = event.currentTarget;
		if (target.scrollTop + target.clientHeight < target.scrollHeight - 120) return;
		setIsFetchingNextPage(true);
		fetchTimeoutRef.current = setTimeout(() => {
			setPage((current) => Math.min(current + 1, totalPages));
			setIsFetchingNextPage(false);
		}, 120);
	}

	useEffect(() => {
		setPage(1);
		setIsFetchingNextPage(false);
		if (fetchTimeoutRef.current) {
			clearTimeout(fetchTimeoutRef.current);
			fetchTimeoutRef.current = null;
		}
	}, []);

	useEffect(() => {
		return () => {
			if (fetchTimeoutRef.current) {
				clearTimeout(fetchTimeoutRef.current);
			}
		};
	}, []);

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="icon"
					disabled={disabled}
					className={cn("justify-center gap-2", showLabel && "px-3", className)}
				>
					<LucideIcon name={currentIcon} className="size-4" />
					{showLabel && (
						<>
							<span className="truncate text-xs">{currentIcon}</span>
							<ChevronDown className="size-3 text-muted-foreground" />
						</>
					)}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" sideOffset={6} className="w-[420px] p-0">
				<div className="max-h-[420px] overflow-y-auto" onScroll={handleScroll}>
					<div className="sticky top-0 z-10 border-b border-border bg-card/95 px-3 py-2 backdrop-blur">
						<div className="flex items-center gap-2">
							<Search className="size-4 text-muted-foreground" />
							<Input
								type="search"
								value={search}
								onChange={(event) => setSearch(event.target.value)}
								placeholder="Pesquisar ícone"
								className="h-8 text-foreground border-transparent bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-transparent"
								autoFocus
							/>
						</div>
					</div>
					{filteredIcons.length === 0 ? (
						<div className="p-6 text-center text-sm text-muted-foreground">
							Nenhum ícone encontrado
						</div>
					) : (
						<div className="grid grid-cols-6 gap-2 p-3 sm:grid-cols-7">
							{visibleIcons.map((iconName) => {
								const isSelected = iconName === currentIcon;
								const displayName = iconName.replaceAll(/([a-z])([A-Z])/g, "$1 $2");
								return (
									<button
										key={iconName}
										type="button"
										onClick={() => handleSelect(iconName)}
										className={cn(
											"group flex flex-col items-center gap-2 rounded-md border border-transparent px-2 py-2 text-[11px] text-muted-foreground transition",
											"hover:border-border hover:bg-muted/40 hover:text-foreground",
											isSelected && "border-primary bg-primary/10 text-foreground",
										)}
									>
										<LucideIcon name={iconName} className="size-5 text-foreground" />
										<span className="w-full truncate">{displayName}</span>
									</button>
								);
							})}
						</div>
					)}
					{hasNextPage && (
						<div className="px-3 pb-4 text-xs text-muted-foreground">
							{isFetchingNextPage ? "Carregando..." : "Role para carregar mais"}
						</div>
					)}
				</div>
			</PopoverContent>
		</Popover>
	);
}

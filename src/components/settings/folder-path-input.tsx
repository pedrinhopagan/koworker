import { useQuery } from "@tanstack/react-query";
import { Check, FolderOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { orpc } from "@/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getCapabilities } from "@/lib/capabilities";
import { pickProjectFolder } from "@/lib/tauri";
import { cn } from "@/lib/utils";

type FolderPathInputProps = {
	value: string;
	onChange: (value: string) => void;
	onBlur?: () => void;
	onEnter?: () => void;
	placeholder?: string;
	id?: string;
	invalid?: boolean;
	className?: string;
	inputClassName?: string;
};

// Campo de pasta que troca de forma conforme o cliente: no Tauri, o botão "..." abre o diálogo
// nativo; no browser, um autocomplete servido pelo backend (system.browseDirectory) valida e sugere
// diretórios reais. Sempre controlado — cada tela integra com seu próprio estado/form.
export function FolderPathInput(props: FolderPathInputProps) {
	if (getCapabilities().canPickFolderNatively) {
		return <NativeFolderInput {...props} />;
	}

	return <WebFolderInput {...props} />;
}

function NativeFolderInput({
	value,
	onChange,
	onBlur,
	onEnter,
	placeholder,
	id,
	invalid,
	className,
	inputClassName,
}: FolderPathInputProps) {
	const [picking, setPicking] = useState(false);

	async function handlePick() {
		if (picking) {
			return;
		}

		setPicking(true);
		const selected = await pickProjectFolder(value.trim() || undefined);
		if (selected) {
			onChange(selected);
		}
		setPicking(false);
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Input
				id={id}
				value={value}
				onChange={(event) => onChange(event.target.value)}
				onBlur={onBlur}
				placeholder={placeholder}
				aria-invalid={invalid}
				className={cn("flex-1 font-mono", inputClassName)}
				onKeyDown={(event) => {
					if (event.key === "Enter" && onEnter) {
						event.preventDefault();
						onEnter();
					}
				}}
			/>
			<Button
				type="button"
				variant="outline"
				onClick={handlePick}
				disabled={picking}
				className="h-9 shrink-0 px-3"
			>
				...
			</Button>
		</div>
	);
}

function WebFolderInput({
	value,
	onChange,
	onBlur,
	onEnter,
	placeholder,
	id,
	invalid,
	className,
	inputClassName,
}: FolderPathInputProps) {
	const [open, setOpen] = useState(false);
	const [highlight, setHighlight] = useState(-1);
	const [debounced, setDebounced] = useState(value);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		const timer = setTimeout(() => setDebounced(value), 150);
		return () => clearTimeout(timer);
	}, [value]);

	const query = useQuery({
		...orpc.system.browseDirectory.queryOptions({ input: { path: debounced } }),
		enabled: open,
	});

	const suggestions = query.data?.suggestions ?? [];
	const valid = query.data?.valid ?? false;

	function select(path: string) {
		onChange(path);
		setOpen(false);
		setHighlight(-1);
	}

	return (
		<div className={cn("relative", className)}>
			<div className="relative">
				<Input
					id={id}
					value={value}
					onChange={(event) => {
						onChange(event.target.value);
						setOpen(true);
						setHighlight(-1);
					}}
					onFocus={() => setOpen(true)}
					onBlur={() => {
						blurTimer.current = setTimeout(() => {
							setOpen(false);
							onBlur?.();
						}, 120);
					}}
					placeholder={placeholder}
					aria-invalid={invalid}
					className={cn("pr-8 font-mono", inputClassName)}
					onKeyDown={(event) => {
						if (event.key === "ArrowDown") {
							event.preventDefault();
							setOpen(true);
							setHighlight((prev) => Math.min(prev + 1, suggestions.length - 1));
						} else if (event.key === "ArrowUp") {
							event.preventDefault();
							setHighlight((prev) => Math.max(prev - 1, 0));
						} else if (event.key === "Enter") {
							event.preventDefault();
							const picked = suggestions[highlight];
							if (picked) {
								select(picked.path);
							} else {
								onEnter?.();
							}
						} else if (event.key === "Escape") {
							setOpen(false);
						}
					}}
				/>
				{value.trim() && valid && (
					<Check className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-emerald-500" />
				)}
			</div>

			{open && suggestions.length > 0 && (
				<ul
					className="absolute z-50 mt-1 max-h-64 w-full overflow-y-auto border border-border bg-popover py-1 shadow-md"
					onMouseDown={(event) => {
						// Evita o blur do input antes de o clique registrar a seleção.
						event.preventDefault();
						if (blurTimer.current) {
							clearTimeout(blurTimer.current);
						}
					}}
				>
					{suggestions.map((suggestion, index) => (
						<li key={suggestion.path}>
							<button
								type="button"
								onClick={() => select(suggestion.path)}
								onMouseEnter={() => setHighlight(index)}
								className={cn(
									"flex w-full items-center gap-2 px-3 py-1.5 text-left font-mono text-xs",
									index === highlight ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
								)}
							>
								<FolderOpen className="size-3.5 shrink-0 text-muted-foreground" />
								<span className="truncate">{suggestion.name}</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

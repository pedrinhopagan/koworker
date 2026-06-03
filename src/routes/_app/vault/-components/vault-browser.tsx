import { Plus } from "lucide-react";

import { Text } from "@/components/typography";
import { entryKey, type VaultEntry, VaultFileCard } from "./vault-file-card";

// Render plano do vault: uma grade de cards de arquivo, sem seções. É o modo secundário (toggle
// "plana" da Fatia 3) e o resultado de busca: enquanto há termo, a lista colapsa pra cá. Entries
// de pasta solta ficam de fora: não há rota de edição pra elas.
export function VaultBrowser({
	entries,
	search,
	organizing,
	onOpen,
	onSelect,
	isSelected,
	onCreateLoose,
	onRenameLoose,
	onDeleteLoose,
}: {
	entries: VaultEntry[];
	search: string;
	organizing: boolean;
	onOpen: (entry: VaultEntry) => void;
	onSelect: (entry: VaultEntry) => void;
	isSelected: (entry: VaultEntry) => boolean;
	onCreateLoose: () => void;
	onRenameLoose: (name: string) => void;
	onDeleteLoose: (name: string) => void;
}) {
	const select = organizing ? onSelect : undefined;
	const term = search.trim().toLowerCase();
	const visible = entries
		.filter((entry) => entry.origin !== "folder")
		.filter(
			(entry) =>
				term === "" ||
				entry.title.toLowerCase().includes(term) ||
				entry.name.toLowerCase().includes(term),
		);

	return (
		<div className="grid grid-cols-1 gap-3 pb-24 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
			{term === "" && (
				<button
					type="button"
					onClick={onCreateLoose}
					className="group flex flex-col items-center justify-center gap-2 border border-dashed border-border bg-card/40 p-4 text-muted-foreground transition-colors hover:border-foreground/40 hover:bg-secondary/40 hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
				>
					<Plus className="size-5" />
					<span className="font-display text-sm font-semibold">Nova nota</span>
				</button>
			)}

			{visible.map((entry, index) => (
				<VaultFileCard
					key={entryKey(entry)}
					entry={entry}
					index={index}
					selected={isSelected(entry)}
					onOpen={select ? undefined : onOpen}
					onSelect={select}
					onRenameLoose={onRenameLoose}
					onDeleteLoose={onDeleteLoose}
				/>
			))}

			{visible.length === 0 && term !== "" && (
				<Text size="sm" tone="muted" className="col-span-full py-8 text-center">
					Nenhum arquivo encontrado para “{search}”.
				</Text>
			)}
		</div>
	);
}

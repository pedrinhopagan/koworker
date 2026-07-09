import { ArrowLeft, ExternalLink, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";

import { Text } from "@/components/typography";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useObjectUrl } from "@/hooks/use-object-url";

type AssetViewerProps = {
	blob: Blob | undefined;
	name: string;
	isLoading: boolean;
	isError: boolean;
	// Fallback pra quando o webview não renderiza a imagem inline: abre o arquivo no app padrão do SO.
	onOpenInOs?: () => void;
};

// Renderiza uma imagem a partir de um Blob, via object URL revogado no unmount/troca. Vai em <img>
// contido e centrado sobre xadrez.
export function AssetViewer({ blob, name, isLoading, isError, onOpenInOs }: AssetViewerProps) {
	const url = useObjectUrl(blob);

	if (isLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Loader2 size={18} className="animate-spin" />
					<Text size="sm" tone="muted">
						Carregando arquivo...
					</Text>
				</div>
			</div>
		);
	}

	if (isError || !blob || !url) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-4">
				<Text size="sm" tone="muted">
					Não foi possível carregar este arquivo.
				</Text>
				{onOpenInOs ? (
					<Button variant="outline" size="sm" onClick={onOpenInOs}>
						<ExternalLink size={14} />
						Abrir no sistema
					</Button>
				) : null}
			</div>
		);
	}

	return (
		<div className="flex h-full w-full items-center justify-center overflow-auto bg-muted/40 p-4">
			<img src={url} alt={name} className="max-h-full max-w-full object-contain" />
		</div>
	);
}

type AssetViewerPageProps = {
	name: string;
	blob: Blob | undefined;
	isLoading: boolean;
	isError: boolean;
	onBack: () => void;
	onOpenInOs?: () => void;
	// Renomear e deletar: opcionais (o dono da rota liga na mutation certa). O rename recebe o nome
	// final e é responsável por navegar pra ele; a página só edita o texto e confirma.
	onRename?: (newName: string) => void;
	onDelete?: () => void;
	deleting?: boolean;
};

// Página completa de visualização de uma imagem: header (voltar, nome/renomear, ações) + a imagem.
// Usada por /media — a rota injeta a query e as mutations.
export function AssetViewerPage({
	name,
	blob,
	isLoading,
	isError,
	onBack,
	onOpenInOs,
	onRename,
	onDelete,
	deleting,
}: AssetViewerPageProps) {
	const [renameValue, setRenameValue] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);

	function commitRename() {
		const next = renameValue?.trim();
		setRenameValue(null);
		if (next && next !== name) {
			onRename?.(next);
		}
	}

	return (
		<div className="relative flex h-full w-full flex-col">
			<div className="w-full border-b border-border">
				<div className="mx-auto flex h-10 w-full max-w-6xl items-center gap-2 px-2">
					<button
						type="button"
						onClick={onBack}
						className="flex items-center px-2 text-muted-foreground transition-colors hover:text-foreground"
						aria-label="Voltar"
					>
						<ArrowLeft size={16} />
					</button>

					{renameValue === null ? (
						<Text size="sm" className="min-w-0 flex-1 truncate font-medium">
							{name}
						</Text>
					) : (
						<input
							// biome-ignore lint/a11y/noAutofocus: input de rename só aparece após o clique explícito.
							autoFocus
							value={renameValue}
							onChange={(event) => setRenameValue(event.target.value)}
							onBlur={commitRename}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									commitRename();
								} else if (event.key === "Escape") {
									setRenameValue(null);
								}
							}}
							className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none"
						/>
					)}

					<div className="flex items-center gap-1">
						{onRename ? (
							<Tooltip label="Renomear">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={() => setRenameValue(name)}
									aria-label="Renomear"
								>
									<Pencil className="h-4 w-4" />
								</Button>
							</Tooltip>
						) : null}
						{onDelete ? (
							<Tooltip label="Deletar">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={() => setConfirmingDelete(true)}
									aria-label="Deletar"
									className="hover:text-destructive"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</Tooltip>
						) : null}
						{onOpenInOs ? (
							<Tooltip label="Abrir no sistema">
								<Button
									type="button"
									variant="ghost"
									size="icon-sm"
									onClick={onOpenInOs}
									aria-label="Abrir no sistema"
								>
									<ExternalLink className="h-4 w-4" />
								</Button>
							</Tooltip>
						) : null}
					</div>
				</div>
			</div>

			<div className="min-h-0 flex-1">
				<AssetViewer
					blob={blob}
					name={name}
					isLoading={isLoading}
					isError={isError}
					onOpenInOs={onOpenInOs}
				/>
			</div>

			<ConfirmDialog
				open={confirmingDelete}
				onClose={() => setConfirmingDelete(false)}
				onConfirm={() => {
					setConfirmingDelete(false);
					onDelete?.();
				}}
				title="Deletar arquivo"
				description={`“${name}” será apagado permanentemente do disco.`}
				confirmLabel="Deletar"
				variant="danger"
				loading={deleting}
			/>
		</div>
	);
}

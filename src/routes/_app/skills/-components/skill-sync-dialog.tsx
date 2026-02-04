import { X } from "lucide-react";
import { useEffect } from "react";

import { Text, Title } from "@/components/typography";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export type SkillSyncMode = "import" | "export";

export type SkillSyncItem = {
	slug: string;
	hasConflict: boolean;
};

type SkillSyncDialogProps = {
	open: boolean;
	mode: SkillSyncMode;
	items: SkillSyncItem[];
	selectedSlugs: string[];
	conflictStrategy: "overwrite" | "ignore";
	loading?: boolean;
	onClose: () => void;
	onConfirm: () => void;
	onToggleSlug: (slug: string) => void;
	onSelectAll: () => void;
	onClearAll: () => void;
	onConflictStrategyChange: (strategy: "overwrite" | "ignore") => void;
};

export function SkillSyncDialog({
	open,
	mode,
	items,
	selectedSlugs,
	conflictStrategy,
	loading = false,
	onClose,
	onConfirm,
	onToggleSlug,
	onSelectAll,
	onClearAll,
	onConflictStrategyChange,
}: SkillSyncDialogProps) {
	useEffect(() => {
		if (!open) return;
		const { body } = document;
		const previousOverflow = body.style.overflow;
		const previousPaddingRight = body.style.paddingRight;
		const scrollBarWidth = window.innerWidth - document.documentElement.clientWidth;

		body.style.overflow = "hidden";
		if (scrollBarWidth > 0) {
			body.style.paddingRight = `${scrollBarWidth}px`;
		}

		return () => {
			body.style.overflow = previousOverflow;
			body.style.paddingRight = previousPaddingRight;
		};
	}, [open]);

	if (!open) return null;

	const selectedSet = new Set(selectedSlugs);
	const directionLabel = mode === "import" ? "pasta para DB" : "DB para pasta";
	const title = mode === "import" ? "Importar skills" : "Exportar skills";
	const confirmLabel = mode === "import" ? "Importar selecionadas" : "Exportar selecionadas";
	const description =
		mode === "import"
			? "Importar da pasta de configuracao para o DB"
			: "Exportar do DB para a pasta de configuracao";

	return (
		<div className="fixed inset-0 z-99999 flex items-center justify-center">
			<button
				type="button"
				aria-label="Fechar dialog"
				onClick={onClose}
				className="absolute inset-0 bg-black/50"
			/>

			<div className="relative z-10 w-full max-w-2xl bg-background border border-border shadow-lg p-6 animate-in fade-in-0 zoom-in-95">
				<div className="flex items-start justify-between gap-4">
					<div>
						<Title size="sm">{title}</Title>
						<Text size="sm" tone="muted" className="mt-1">
							{description}
						</Text>
					</div>
					<Button variant="ghost" size="icon" onClick={onClose} aria-label="Fechar">
						<X className="h-4 w-4" />
					</Button>
				</div>

				<div className="mt-6 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="space-y-1">
							<Text size="xs" tone="muted" className="uppercase tracking-wide">
								Conflitos
							</Text>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant={conflictStrategy === "overwrite" ? "default" : "outline"}
									onClick={() => onConflictStrategyChange("overwrite")}
									disabled={loading}
								>
									Sobrescrever
								</Button>
								<Button
									size="sm"
									variant={conflictStrategy === "ignore" ? "default" : "outline"}
									onClick={() => onConflictStrategyChange("ignore")}
									disabled={loading}
								>
									Ignorar
								</Button>
							</div>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<Text size="xs" tone="muted">
								Selecionadas: {selectedSlugs.length}/{items.length}
							</Text>
							<Button size="sm" variant="ghost" onClick={onSelectAll} disabled={loading}>
								Selecionar tudo
							</Button>
							<Button size="sm" variant="ghost" onClick={onClearAll} disabled={loading}>
								Limpar
							</Button>
						</div>
					</div>

					<div className="border border-border max-h-[360px] overflow-y-auto">
						{loading && (
							<div className="p-4">
								<Text size="sm" tone="muted">
									Carregando skills...
								</Text>
							</div>
						)}

						{!loading && items.length === 0 && (
							<div className="p-4">
								<Text size="sm" tone="muted">
									Nenhuma skill encontrada
								</Text>
							</div>
						)}

						{!loading && items.length > 0 && (
							<div className="divide-y divide-border">
								{items.map((item) => {
									const checked = selectedSet.has(item.slug);
									const checkboxId = `${mode}-${item.slug}`;
									return (
										<div key={item.slug} className="flex items-start gap-3 p-3">
											<Checkbox
												id={checkboxId}
												checked={checked}
												onCheckedChange={() => onToggleSlug(item.slug)}
												disabled={loading}
											/>
											<label htmlFor={checkboxId} className="flex-1 min-w-0">
												<Text size="sm" className="font-medium">
													{item.slug}
												</Text>
												<Text size="xs" tone="muted">
													{directionLabel}
												</Text>
											</label>
											{item.hasConflict && <Badge variant="warning">Conflito</Badge>}
										</div>
									);
								})}
							</div>
						)}
					</div>
				</div>

				<div className="mt-6 flex justify-end gap-3">
					<Button variant="outline" onClick={onClose} disabled={loading}>
						Cancelar
					</Button>
					<Button onClick={onConfirm} disabled={loading || selectedSlugs.length === 0}>
						{loading ? "Aguarde..." : confirmLabel}
					</Button>
				</div>
			</div>
		</div>
	);
}

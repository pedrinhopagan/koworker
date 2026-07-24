import { useCallback, useEffect, useRef, useState } from "react";

import { Text } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export type SkillStandardizePreview = {
	planHash: string;
	updated: number;
	created: number;
	removedFiles: number;
};

export function SkillStandardizeDialog({
	open,
	label,
	flush,
	loadPreview,
	apply,
	onClose,
}: {
	open: boolean;
	label: string;
	flush: () => Promise<void>;
	loadPreview: () => Promise<SkillStandardizePreview>;
	apply: (planHash: string) => Promise<unknown>;
	onClose: () => void;
}) {
	const [preview, setPreview] = useState<SkillStandardizePreview | null>(null);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string>();
	const flushRef = useRef(flush);
	const loadPreviewRef = useRef(loadPreview);
	const requestRef = useRef(0);
	flushRef.current = flush;
	loadPreviewRef.current = loadPreview;

	const refresh = useCallback(async () => {
		const request = requestRef.current + 1;
		requestRef.current = request;
		setLoading(true);
		setError(undefined);
		setPreview(null);
		try {
			await flushRef.current();
			const next = await loadPreviewRef.current();
			if (request === requestRef.current) {
				setPreview(next);
			}
		} catch (caught) {
			if (request === requestRef.current) {
				setError(caught instanceof Error ? caught.message : "Não foi possível calcular o impacto");
			}
		} finally {
			if (request === requestRef.current) {
				setLoading(false);
			}
		}
	}, []);

	useEffect(() => {
		if (open) {
			void refresh();
			return;
		}
		requestRef.current += 1;
	}, [open, refresh]);

	async function confirm() {
		if (!preview) {
			return;
		}
		setLoading(true);
		try {
			await apply(preview.planHash);
			onClose();
		} catch (caught: any) {
			if (caught?.code === "CONFLICT") {
				await refresh();
				return;
			}
			setError(caught instanceof Error ? caught.message : "Não foi possível padronizar a skill");
		} finally {
			setLoading(false);
		}
	}

	return (
		<ConfirmDialog
			open={open}
			onClose={onClose}
			onConfirm={() => void confirm()}
			title="Definir como principal"
			description={`A pasta de “${label}” será espelhada nas demais fontes.`}
			confirmLabel="Confirmar"
			variant="danger"
			loading={loading}
			confirmDisabled={!preview || !!error}
		>
			{loading && !preview && (
				<Text size="sm" tone="muted">
					Calculando impacto…
				</Text>
			)}
			{error && (
				<Text size="sm" tone="destructive" data-slot="standardize-error">
					{error}
				</Text>
			)}
			{preview && (
				<div className="flex flex-col gap-1" data-slot="standardize-preview">
					<Text size="sm">{preview.updated} fonte(s) atualizada(s)</Text>
					<Text size="sm">{preview.created} fonte(s) criada(s)</Text>
					<Text size="sm" tone={preview.removedFiles > 0 ? "destructive" : "muted"}>
						{preview.removedFiles} arquivo(s) extra(s) removido(s)
					</Text>
				</div>
			)}
		</ConfirmDialog>
	);
}

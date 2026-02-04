import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Book } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useSkillsQuery } from "@/hooks/use-skills";
import { SkillEditor } from "./-components/skill-editor";
import { SkillSyncDialog } from "./-components/skill-sync-dialog";
import { SkillsList } from "./-components/skills-list";

export const Route = createFileRoute("/_app/skills/")({
	component: SkillsPage,
});

function SkillsPage() {
	const queryClient = useQueryClient();
	const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);
	const [syncMode, setSyncMode] = useState<"import" | "export" | null>(null);
	const [conflictStrategy, setConflictStrategy] = useState<"overwrite" | "ignore">("ignore");
	const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
	const seededSelectionRef = useRef(false);
	const [isSyncDefaultsOpen, setIsSyncDefaultsOpen] = useState(false);

	const skillsQueryOptions = orpc.skills.list.queryOptions();
	const skillsQueryKey = skillsQueryOptions.queryKey;
	const skillsQuery = useSkillsQuery();

	function handleCloseSyncDialog() {
		setSyncMode(null);
		setConflictStrategy("ignore");
		setSelectedSlugs([]);
		seededSelectionRef.current = false;
	}

	const importMutation = useMutation({
		...orpc.skills.importFromConfig.mutationOptions(),
		onSuccess: (data) => {
			toast.success(
				`${data.imported} importada(s) • ${data.overwritten} sobrescrita(s) • ${data.skipped} ignorada(s)`,
			);
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			handleCloseSyncDialog();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao importar: ${error.message}`);
		},
	});

	const exportMutation = useMutation({
		...orpc.skills.exportToConfig.mutationOptions(),
		onSuccess: (data) => {
			toast.success(
				`${data.exported} exportada(s) • ${data.overwritten} sobrescrita(s) • ${data.skipped} ignorada(s)`,
			);
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			handleCloseSyncDialog();
		},
		onError: (error: Error) => {
			toast.error(`Erro ao exportar: ${error.message}`);
		},
	});

	const syncDefaultsMutation = useMutation({
		...orpc.skills.syncDefaultsFromStatic.mutationOptions(),
		onSuccess: (data) => {
			toast.success(`${data.inserted} skill(s) sincronizada(s) com defaults`);
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
			setIsSyncDefaultsOpen(false);
		},
		onError: (error: Error) => {
			toast.error(`Erro ao sincronizar defaults: ${error.message}`);
		},
	});

	const previewImportQuery = useQuery({
		...orpc.skills.previewImportFromConfig.queryOptions(),
		enabled: syncMode === "import",
	});

	const previewExportQuery = useQuery({
		...orpc.skills.previewExportToConfig.queryOptions(),
		enabled: syncMode === "export",
	});

	const syncItems = useMemo(() => {
		if (syncMode === "import") return previewImportQuery.data ?? [];
		if (syncMode === "export") return previewExportQuery.data ?? [];
		return [];
	}, [syncMode, previewImportQuery.data, previewExportQuery.data]);

	useEffect(() => {
		if (!syncMode) return;
		if (seededSelectionRef.current) return;
		if (syncItems.length === 0) return;
		setSelectedSlugs(syncItems.map((item) => item.slug));
		seededSelectionRef.current = true;
	}, [syncMode, syncItems]);

	const previewLoading =
		syncMode === "import"
			? previewImportQuery.isLoading
			: syncMode === "export"
				? previewExportQuery.isLoading
				: false;
	const syncLoading = importMutation.isPending || exportMutation.isPending || previewLoading;

	const handleToggleSlug = (slug: string) => {
		setSelectedSlugs((prev) =>
			prev.includes(slug) ? prev.filter((item) => item !== slug) : [...prev, slug],
		);
	};

	const handleSelectAll = () => {
		setSelectedSlugs(syncItems.map((item) => item.slug));
	};

	const handleClearAll = () => {
		setSelectedSlugs([]);
	};

	const handleConfirmSync = () => {
		if (!syncMode || selectedSlugs.length === 0) return;

		if (syncMode === "import") {
			importMutation.mutate({
				slugs: selectedSlugs,
				conflictStrategy,
			});
			return;
		}

		exportMutation.mutate({
			slugs: selectedSlugs,
			conflictStrategy,
		});
	};

	const handleImport = () => {
		if (importMutation.isPending) return;
		setSyncMode("import");
		setConflictStrategy("ignore");
		setSelectedSlugs([]);
		seededSelectionRef.current = false;
	};

	const handleExport = () => {
		if (exportMutation.isPending) return;
		setSyncMode("export");
		setConflictStrategy("ignore");
		setSelectedSlugs([]);
		seededSelectionRef.current = false;
	};

	const handleSyncDefaults = () => {
		if (syncDefaultsMutation.isPending) return;
		setIsSyncDefaultsOpen(true);
	};

	const handleConfirmSyncDefaults = () => {
		syncDefaultsMutation.mutate(undefined as void);
	};

	const handleNewSkill = () => {
		setSelectedSkillId(null);
		setIsCreating(true);
	};

	const handleSelectSkill = (id: string) => {
		setSelectedSkillId(id);
		setIsCreating(false);
	};

	const handleCloseEditor = () => {
		setSelectedSkillId(null);
		setIsCreating(false);
		queryClient.invalidateQueries({ queryKey: skillsQueryKey });
	};

	const skills = skillsQuery.data ?? [];
	const selectedSkill = useMemo(() => {
		if (!selectedSkillId) return null;
		return skills.find((s: { id: string }) => s.id === selectedSkillId) ?? null;
	}, [selectedSkillId, skills]);
	const showEditor = isCreating || selectedSkill !== null;

	return (
		<PageShell
			title="Skills"
			description="Gerencie as skills do OpenCode disponíveis para seus projetos"
			icon={Book}
			variant="grid"
		>
			<ConfirmDialog
				open={isSyncDefaultsOpen}
				onClose={() => setIsSyncDefaultsOpen(false)}
				onConfirm={handleConfirmSyncDefaults}
				title="Sincronizar defaults"
				description="Isso remove as skills nativas do DB e injeta novamente as da pasta static."
				confirmLabel="Sincronizar"
				variant="danger"
				loading={syncDefaultsMutation.isPending}
			/>
			<SkillSyncDialog
				open={syncMode !== null}
				mode={syncMode ?? "import"}
				items={syncItems}
				selectedSlugs={selectedSlugs}
				conflictStrategy={conflictStrategy}
				loading={syncLoading}
				onClose={handleCloseSyncDialog}
				onConfirm={handleConfirmSync}
				onToggleSlug={handleToggleSlug}
				onSelectAll={handleSelectAll}
				onClearAll={handleClearAll}
				onConflictStrategyChange={setConflictStrategy}
			/>
			<SkillsList
				skills={skills}
				selectedId={selectedSkillId}
				onSelect={handleSelectSkill}
				onNew={handleNewSkill}
				onImport={handleImport}
				onExport={handleExport}
				onSyncDefaults={handleSyncDefaults}
				importing={importMutation.isPending}
				exporting={exportMutation.isPending}
				syncingDefaults={syncDefaultsMutation.isPending}
				loading={skillsQuery.isLoading}
			/>

			<section className="space-y-4 min-h-0 min-w-0 h-full overflow-y-auto px-4 pb-4">
				{showEditor && (
					<SkillEditor
						skill={selectedSkill ?? undefined}
						onClose={handleCloseEditor}
						onSave={handleCloseEditor}
					/>
				)}
				{!showEditor && (
					<div className="flex items-center justify-center h-full">
						<div className="text-center space-y-2">
							<Book className="h-12 w-12 mx-auto text-muted-foreground" />
							<Text tone="muted">Selecione uma skill para editar ou crie uma nova</Text>
						</div>
					</div>
				)}
			</section>
		</PageShell>
	);
}

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Book } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { orpc } from "@/client";
import { PageShell } from "@/components/layout/page-shell";
import { Text } from "@/components/typography";
import { useSkillsQuery } from "@/hooks/use-skills";
import { SkillEditor } from "./-components/skill-editor";
import { SkillsList } from "./-components/skills-list";

export const Route = createFileRoute("/_app/skills/")({
	component: SkillsPage,
});

function SkillsPage() {
	const queryClient = useQueryClient();
	const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
	const [isCreating, setIsCreating] = useState(false);

	const skillsQueryOptions = orpc.skills.list.queryOptions();
	const skillsQueryKey = skillsQueryOptions.queryKey;
	const skillsQuery = useSkillsQuery();

	const importMutation = useMutation({
		...orpc.skills.importFromConfig.mutationOptions(),
		onSuccess: (data) => {
			toast.success(`${data.imported} skill(s) importada(s) • ${data.skipped} ignorada(s)`);
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
		},
		onError: (error: Error) => {
			toast.error(`Erro ao importar: ${error.message}`);
		},
	});

	const exportMutation = useMutation({
		...orpc.skills.exportToConfig.mutationOptions(),
		onSuccess: (data) => {
			toast.success(`${data.exported} skill(s) exportada(s) • ${data.skipped} ignorada(s)`);
			queryClient.invalidateQueries({ queryKey: skillsQueryKey });
		},
		onError: (error: Error) => {
			toast.error(`Erro ao exportar: ${error.message}`);
		},
	});

	const handleImport = () => {
		if (importMutation.isPending) return;
		importMutation.mutate();
	};

	const handleExport = () => {
		if (exportMutation.isPending) return;
		exportMutation.mutate();
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
			<SkillsList
				skills={skills}
				selectedId={selectedSkillId}
				onSelect={handleSelectSkill}
				onNew={handleNewSkill}
				onImport={handleImport}
				onExport={handleExport}
				importing={importMutation.isPending}
				exporting={exportMutation.isPending}
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
